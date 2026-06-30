import "./globals.css";
import 'react-international-phone/style.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import { euclid } from "./fonts";


export const metadata = {
  title: "WhatsApp Auto by GoMindz",
  description: "Send bulk WhatsApp messages with AI-powered message generation",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${euclid.variable} min-h-screen antialiased`} suppressHydrationWarning>
      <body className="min-h-screen bg-[#070b09] text-white overflow-x-hidden">
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#111111',
                color: '#ffffff',
                border: '1px solid #1f1f1f'
              }
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}