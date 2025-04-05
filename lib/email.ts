// Utilidad para enviar correos electrónicos
// Esta es una implementación básica, en producción podrías usar servicios como SendGrid, Mailgun, etc.

import nodemailer from 'nodemailer';

// Definir la interfaz para opciones de email
type EmailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

// Configurar el transportador de nodemailer
// En producción, esto debería usar credenciales reales
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || 'user@example.com',
    pass: process.env.EMAIL_PASSWORD || 'password',
  },
});

/**
 * Envía un correo electrónico
 * @param options Opciones del correo
 * @returns Promise que se resuelve cuando el correo es enviado
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (process.env.NODE_ENV === 'development') {
      // En desarrollo, simular el envío de correo y registrar en consola
      console.log('---- EMAIL SIMULADO ----');
      console.log(`Para: ${options.to}`);
      console.log(`Asunto: ${options.subject}`);
      console.log(`Contenido: ${options.text}`);
      console.log('------------------------');
      return true;
    }

    // Configurar mensaje
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      ...options,
    };

    // Enviar email
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error al enviar email:', error);
    return false;
  }
} 