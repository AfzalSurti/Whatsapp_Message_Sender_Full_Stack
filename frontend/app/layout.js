import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "WhatsApp Message Sender ",
  description: "Send bulk WhatsApp messages with AI-powered message generation",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
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