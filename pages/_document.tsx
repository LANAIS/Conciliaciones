import React from 'react';
import Document, {
   Html,
   Head,
   Main,
   NextScript,
   DocumentContext,
   DocumentInitialProps,
} from 'next/document';
import {CssBaseline} from '@nextui-org/react';
import { getCSRFTokenScript } from '../lib/csrf';

class MyDocument extends Document {
   static async getInitialProps(
      ctx: DocumentContext
   ): Promise<DocumentInitialProps> {
      const initialProps = await Document.getInitialProps(ctx);
      return {
         ...initialProps,
         styles: React.Children.toArray([initialProps.styles]),
      };
   }

   render() {
      return (
         <Html lang="es">
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link
               rel="preconnect"
               href="https://fonts.gstatic.com"
               crossOrigin="true"
            />
            <link
               href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
               rel="stylesheet"
            />
            <meta name="theme-color" content="#121212" />
            <Head>{CssBaseline.flush()}</Head>

            <body className="bg-gray-900 text-white">
               <Main />
               <NextScript />
               <script 
                  dangerouslySetInnerHTML={{ 
                     __html: getCSRFTokenScript() 
                  }} 
               />
            </body>
         </Html>
      );
   }
}

export default MyDocument;
