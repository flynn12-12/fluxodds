import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const { priceId, email, userId } = await request.json()
    console.log('Checkout called with:', priceId, email)
    console.log('Stripe key exists:', !!process.env.STRIPE_SECRET_KEY)

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 3,
      },
      metadata: {
        user_id: userId,
      },
      success_url: 'https://fluxodds.com?success=true',
      cancel_url: 'https://fluxodds.com?canceled=true',
    })

    return Response.json({ url: session.url })
  } catch (error) {
    console.error('Stripe error:', error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }
}