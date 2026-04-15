/**
 * Edge Function : create-checkout-session
 * Crée une session Stripe Checkout et retourne l'URL de redirection.
 *
 * Secrets requis (Supabase Dashboard → Settings → Edge Functions → Secrets) :
 *   STRIPE_SECRET_KEY   — sk_live_... ou sk_test_...
 *   SITE_URL            — ex: https://votre-domaine.com
 */
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2024-04-10',
    httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SITE_URL            = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';

Deno.serve(async (req: Request) => {
    // CORS pre-flight
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, content-type',
            },
        });
    }

    try {
        // 1. Authentifier l'utilisateur via le JWT Supabase
        const authHeader = req.headers.get('Authorization') ?? '';
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (authError || !user) {
            return jsonError('Non authentifié', 401);
        }

        // 2. Lire le corps de la requête
        const { priceId, billing } = await req.json() as { priceId: string; billing: 'monthly' | 'yearly' };
        if (!priceId) return jsonError('priceId manquant', 400);

        // 3. Récupérer ou créer le customer Stripe
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id, email, full_name')
            .eq('id', user.id)
            .single();

        let customerId: string = profile?.stripe_customer_id ?? '';
        if (!customerId) {
            const customer = await stripe.customers.create({
                email:    profile?.email ?? user.email,
                name:     profile?.full_name ?? '',
                metadata: { supabase_user_id: user.id },
            });
            customerId = customer.id;
            await supabase
                .from('profiles')
                .update({ stripe_customer_id: customerId })
                .eq('id', user.id);
        }

        // 4. Créer la session Checkout
        const session = await stripe.checkout.sessions.create({
            customer:    customerId,
            mode:        'subscription',
            line_items:  [{ price: priceId, quantity: 1 }],
            success_url: `${SITE_URL}/index.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url:  `${SITE_URL}/index.html?checkout=canceled`,
            locale:      'fr',        // Page Stripe en français
            allow_promotion_codes: true,
            subscription_data: {
                trial_period_days: 14,   // Essai gratuit 14 jours
                metadata: { supabase_user_id: user.id },
            },
            metadata: { supabase_user_id: user.id },
        });

        return json({ url: session.url });
    } catch (err) {
        console.error('[create-checkout-session]', err);
        return jsonError(String(err), 500);
    }
});

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
    });
}

function jsonError(message: string, status: number) {
    return json({ error: message }, status);
}
