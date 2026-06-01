/** @type {import('next').NextConfig} */
const useStandaloneOutput = process.env.NEXT_OUTPUT_MODE === "standalone";

const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  ...(useStandaloneOutput ? { output: "standalone" } : {})
};

export default nextConfig;
