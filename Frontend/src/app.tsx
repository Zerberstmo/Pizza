import { RouterProvider } from "react-router";
import { CartProvider } from "@/hooks/use-cart";
import { FavoritesProvider } from "@/hooks/use-favorites";
import { router } from "@/router";

export default function App() {
  return (
    <CartProvider>
      <FavoritesProvider>
        <div
          className="min-h-screen bg-background text-foreground max-w-lg mx-auto relative"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          <RouterProvider router={router} />
        </div>
      </FavoritesProvider>
    </CartProvider>
  );
}
