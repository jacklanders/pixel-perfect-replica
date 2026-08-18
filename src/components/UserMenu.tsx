import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth, nombreVisible, iniciales } from "@/hooks/useAuth";

export function UserMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, cargando } = useAuth();

  const name = nombreVisible(user);
  const initials = iniciales(name);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    // El signOut real lo hace la implementación del hook de auth (localStorage hoy,
    // cookies cuando entre el patch de Claude). Limpiamos caché y navegamos.
    const { supabase } = await import("@/lib/supabase/client");
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  if (cargando || !user) {
    return (
      <div className="flex items-center gap-2">
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
        <div className="bg-muted h-4 w-24 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-xs font-medium text-secondary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[120px] truncate text-sm font-medium">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/perfil" className="flex cursor-pointer items-center gap-2">
            <User className="size-4" />
            Perfil
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleSignOut}
          className="flex cursor-pointer items-center gap-2"
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
