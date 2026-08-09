import path from "path";

export default {
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    setupFiles: ['dotenv/config'],
  },
};
