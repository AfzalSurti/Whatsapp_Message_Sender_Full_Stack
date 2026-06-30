import localFont from "next/font/local";

export const euclid = localFont({
  src: [
    {
      path: "../public/fonts/euclid/Euclid Circular A Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/euclid/Euclid Circular A Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/euclid/Euclid Circular A Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/euclid/Euclid Circular A Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/euclid/Euclid Circular A Medium Italic.woff2",
      weight: "500",
      style: "italic",
    },
    {
      path: "../public/fonts/euclid/Euclid Circular A SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/euclid/Euclid Circular A Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/euclid/Euclid Circular A Bold Italic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-euclid",
  display: "swap",
});