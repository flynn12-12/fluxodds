import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  const { email } = await request.json()

  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 })
  }

  try {
    await resend.emails.send({
      from: 'FluxOdds <onboarding@resend.dev>',
      to: 'johnsonandflynn@gmail.com',
      subject: 'New FluxOdds Signup!',
      html: `<p>New signup: <strong>${email}</strong></p>`
    })

    return Response.json({ success: true })
  } catch (error) {
    return Response.json({ error: 'Failed to send' }, { status: 500 })
  }
}