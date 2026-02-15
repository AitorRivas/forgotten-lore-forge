import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EMAIL_HTML = (email: string, confirmUrl: string) => `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0d0d1a;font-family:Georgia,serif;">
  <div style="max-width:520px;margin:40px auto;background:#1a1a2e;color:#e0d6c8;padding:36px;border:1px solid #d4af37;border-radius:8px;">
    <h1 style="text-align:center;color:#d4af37;font-size:26px;margin:0 0 4px;">⚔️ Crónicas de Faerûn</h1>
    <p style="text-align:center;color:#a89272;font-size:13px;margin:0 0 24px;">Motor narrativo para D&amp;D 5e</p>
    <hr style="border:none;border-top:1px solid #333;margin:0 0 24px;">
    <p style="font-size:15px;line-height:1.6;">¡Saludos, aventurero!</p>
    <p style="font-size:15px;line-height:1.6;">
      Has solicitado inscribirte en los registros de Faerûn con el correo 
      <strong style="color:#d4af37;">${email}</strong>.
    </p>
    <p style="font-size:15px;line-height:1.6;">
      Confirma tu identidad pulsando el siguiente botón para completar tu inscripción:
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${confirmUrl}" 
         style="background:#d4af37;color:#1a1a2e;padding:14px 36px;text-decoration:none;border-radius:4px;font-weight:bold;font-size:15px;display:inline-block;">
        Verificar mi cuenta
      </a>
    </div>
    <p style="font-size:13px;color:#888;line-height:1.5;">
      Si no has creado esta cuenta, puedes ignorar este mensaje con total seguridad.
    </p>
    <hr style="border:none;border-top:1px solid #333;margin:24px 0 16px;">
    <p style="text-align:center;font-size:11px;color:#555;margin:0;">© Creado por diFFFerent</p>
  </div>
</body>
</html>`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  try {
    const { email, password, redirect_to } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'email is required' }), { status: 400, headers: corsHeaders });
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Generate confirmation link using admin API
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const redirectTo = redirect_to || 'https://1520aa3c-209e-4f9c-b475-4328e6f11771.lovableproject.com';

    // Try signup first; if user already exists, fall back to magiclink
    let linkData;
    const { data: signupData, error: signupError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password: password || crypto.randomUUID(),
      options: { redirectTo },
    });

    if (signupError) {
      if (signupError.message?.includes('already been registered')) {
        console.log('User exists, generating magiclink instead');
        const { data: mlData, error: mlError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo },
        });
        if (mlError) {
          console.error('Error generating magiclink:', mlError);
          throw new Error('Could not generate confirmation link: ' + mlError.message);
        }
        linkData = mlData;
      } else {
        console.error('Error generating link:', signupError);
        throw new Error('Could not generate confirmation link: ' + signupError.message);
      }
    } else {
      linkData = signupData;
    }

    const confirmUrl = linkData?.properties?.action_link;
    if (!confirmUrl) {
      throw new Error('No confirmation URL generated');
    }

    // Send email via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Crónicas de Faerûn <onboarding@resend.dev>',
        to: [email],
        subject: '⚔️ Confirma tu inscripción en Crónicas de Faerûn',
        html: EMAIL_HTML(email, confirmUrl),
      }),
    });

    if (!resendRes.ok) {
      const resendError = await resendRes.text();
      console.error('Resend error:', resendError);
      throw new Error('Failed to send email: ' + resendError);
    }

    const result = await resendRes.json();
    return new Response(JSON.stringify({ success: true, id: result.id }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    console.error('Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
