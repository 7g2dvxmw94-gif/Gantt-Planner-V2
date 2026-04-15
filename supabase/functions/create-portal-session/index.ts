/**
 * Edge Function : create-portal-session
 * Crée une session Stripe Customer Portal pour que l'utilisateur puisse
 * gérer son abonnement (changer de plan, télécharger les factures, résilier).
 *
 * Secrets requis :
 *   STRIPE_SECRET_KEY
 *   SITE_URL
 */
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2024-04-10',
    httpClient: Stripe.createFetchHttpClient(),
});

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SITE_URL             = Deno.env.get('SITE_URL') ?? 'http://localhost:3000';

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, content-type',
            },
        });
    }

    try {
        const authHeader = req.headers.get('Authorization') ?? '';
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );
        if (authError || !user) return jsonError('Non authentifié', 401);

        const { returnUrl } = await req.json() as { returnUrl?: string };

        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();

        if (!profile?.stripe_customer_id) {
            return jsonError('Aucun abonnement actif trouvé.', 400);
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer:   profile.stripe_customer_id,
            return_url: returnUrl ?? `${SITE_URL}/index.html`,
        });

        return json({ url: portalSession.url });
    } catch (err) {
        console.error('[create-portal-session]', err);
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
