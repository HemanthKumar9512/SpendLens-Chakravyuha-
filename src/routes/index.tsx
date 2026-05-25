import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/")({
  component: () => {
    const { user, loading } = useAuth();
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-10 w-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      );
    }
    return <Navigate to={user ? "/dashboard" : "/login"} />;
  },
});
