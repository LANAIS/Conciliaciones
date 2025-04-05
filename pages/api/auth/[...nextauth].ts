import NextAuth, { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { JWT } from 'next-auth/jwt';
import { Session } from 'next-auth';

// Extender los tipos de NextAuth para incluir datos adicionales
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      memberships?: UserMembership[];
      primaryOrganization?: { id: string; name: string };
      primaryRole?: { id: string; name: string };
    };
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    memberships?: UserMembership[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    memberships?: UserMembership[];
  }
}

// Tipo para las membresías del usuario
interface UserMembership {
  id: string;
  organizationId: string;
  organizationName: string;
  roleId: string;
  roleName: string;
}

// Inicializar PrismaClient (con manejo de conexiones)
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      // El nombre que se mostrará en el botón de inicio de sesión
      name: 'Credentials',
      // Las credenciales utilizadas para iniciar sesión
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Se requieren credenciales completas');
        }

        try {
          // Buscar el usuario en la base de datos
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            },
            include: {
              memberships: {
                include: {
                  organization: true,
                  role: true
                }
              }
            }
          });

          // Si no se encuentra el usuario
          if (!user) {
            throw new Error('Usuario no encontrado');
          }
          
          // Verificar la contraseña
          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          if (!isPasswordValid) {
            throw new Error('Contraseña incorrecta');
          }

          // Crear un objeto de usuario simplificado
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            // Simplificamos para reducir tamaño - solo incluir la membresía principal
            memberships: user.memberships.length > 0 ? [{
              id: user.memberships[0].id,
              organizationId: user.memberships[0].organizationId,
              organizationName: user.memberships[0].organization.name,
              roleId: user.memberships[0].roleId,
              roleName: user.memberships[0].role.name
            }] : []
          };
        } catch (error) {
          console.error('Error en authorize:', error);
          throw error;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        // Guardar membresías en el token
        token.memberships = user.memberships;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token && session.user) {
        session.user.id = token.id;
        // Añadir membresías a la sesión del usuario
        session.user.memberships = token.memberships;
        
        // Añadir el rol principal para facilitar comprobaciones
        const primaryMembership = token.memberships?.[0];
        if (primaryMembership) {
          session.user.primaryOrganization = {
            id: primaryMembership.organizationId,
            name: primaryMembership.organizationName,
          };
          session.user.primaryRole = {
            id: primaryMembership.roleId,
            name: primaryMembership.roleName,
          };
        }
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/login', // Redirigir a login con mensaje de error
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);