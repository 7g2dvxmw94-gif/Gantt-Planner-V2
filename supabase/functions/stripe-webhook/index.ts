/**
 * Edge Function : stripe-webhook
 * Reçoit les événements Stripe et met à jour la table profiles en conséquence.
 *
 * Secrets requis :
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET   — whsec_... (depuis Stripe Dashboard → Webhooks)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Événements Stripe à activer dans le dashboard :
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_failed
 */
import Stripe from 'https://esm.sh/stripe@14?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
    apiVersion: '2024-04-10',
    httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET       = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/** Mappe un statut Stripe vers notre statut interne */
function mapStatus(stripeStatus: string): string {
    const map: Record<string, string> = {
        active:            'active',
        trialing:          'trialing',
        canceled:          'canceled',
        incomplete:        'past_due',
        incomplete_expired:'canceled',
        past_due:          'past_due',
        unpaid:            'past_due',
        paused:            'canceled',
    };
    return map[stripeStatus] ?? 'active';
}

/** Détermine le plan à partir du Price ID */
function planFromPriceId(priceId: string): 'pro' | 'team' | 'free' {
    // Remplacez par votre logique réelle selon vos Price IDs
    if (priceId.includes('TEAM') || priceId.includes('team')) return 'team';
    if (priceId.includes('PRO')  || priceId.includes('pro'))  return 'pro';
    return 'free';
}

Deno.serve(async (req: Request) => {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature') ?? '';
    const body      = await req.text();

    let event: Stripe.Event;
    try {
        event = await stripe.webhooks.constructEventAsync(body, signature, WEBHOOK_SECRET);
    } catch (err) {
        console.error('[webhook] signature invalide:', err);
        return new Response('Webhook signature invalide', { status: 400 });
    }

    console.log(`[webhook] event: ${event.type}`);

    try {
        switch (event.type) {

            // ── Checkout terminé (nouveau subscriber) ──────────────────
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId  = session.metadata?.supabase_user_id;
                if (!userId || !session.subscription) break;

                const sub = await stripe.subscriptions.retrieve(session.subscription as string);
                const priceId = sub.items.data[0]?.price.id ?? '';

                await supabase.from('profiles').update({
                    plan:                    planFromPriceId(priceId),
                    plan_status:             mapStatus(sub.status),
                    trial_ends_at:           sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
                    stripe_subscription_id:  sub.id,
                    stripe_customer_id:      sub.customer as string,
                }).eq('id', userId);
                break;
            }

            // ── Abonnement mis à jour (upgrade, downgrade, renouvellement) ──
            case 'customer.subscription.updated': {
                const sub    = event.data.object as Stripe.Subscription;
                const userId = sub.metadata?.supabase_user_id;
                if (!userId) {
                    // Fallback : retrouver l'user via stripe_customer_id
                    const { data } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('stripe_customer_id', sub.customer as string)
                        .single();
                    if (!data) break;
                    await updateProfileFromSub(data.id, sub);
                } else {
                    await updateProfileFromSub(userId, sub);
                }
                break;
            }

            // ── Abonnement annulé / expiré ──────────────────────────────
            case 'customer.subscription.deleted': {
                const sub = event.data.object as Stripe.Subscription;
                const { data } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('stripe_subscription_id', sub.id)
                    .single();
                if (!data) break;
                await supabase.from('profiles').update({
                    plan:                   'free',
                    plan_status:            'canceled',
                    stripe_subscription_id: null,
                }).eq('id', data.id);
                break;
            }

            // ── Paiement échoué ─────────────────────────────────────────
            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                const { data } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('stripe_customer_id', invoice.customer as string)
                    .single();
                if (data) {
                    await supabase.from('profiles')
                        .update({ plan_status: 'past_due' })
                        .eq('id', data.id);
                }
                break;
            }

            default:
                console.log(`[webhook] événement ignoré: ${event.type}`);
        }
    } catch (err) {
        console.error('[webhook] erreur traitement:', err);
        return new Response('Erreur interne', { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
    });
});

async function updateProfileFromSub(userId: string, sub: Stripe.Subscription) {
    const priceId = sub.items.data[0]?.price.id ?? '';
    await supabase.from('profiles').update({
        plan:           planFromPriceId(priceId),
        plan_status:    mapStatus(sub.status),
        trial_ends_at:  sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    }).eq('id', userId);
}
