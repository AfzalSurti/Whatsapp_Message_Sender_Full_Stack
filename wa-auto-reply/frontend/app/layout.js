import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import 'react-international-phone/style.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'WA Auto Reply',
  description: 'WhatsApp Auto Reply and AI Templates — standalone assistant',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-[#070b09] text-white">
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
