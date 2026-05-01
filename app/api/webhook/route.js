import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return Response.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const email = session.customer_email

    await supabase
      .from('profiles')
      .update({ plan: 'pro' })
      .eq('email', email)
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object
    const customer = await stripe.customers.retrieve(subscription.customer)
    const email = customer.email

    await supabase
      .from('profiles')
      .update({ plan: 'free' })
      .eq('email', email)
  }

  return Response.json({ received: true })
}