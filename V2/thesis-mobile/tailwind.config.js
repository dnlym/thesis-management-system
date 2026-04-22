/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: "#0066cc",
                    light: "#e6f0ff",
                    dark: "#004a99",
                },
                secondary: {
                    DEFAULT: "#00cccc",
                    light: "#e6ffff",
                    dark: "#009999",
                }
            }
        },
    },
    plugins: [],
}
