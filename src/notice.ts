/** Notificação no canto inferior direito da janela de cadastro. */
export interface Notice {
  /** Sucesso e informação somem sozinhos; erro fica até ser fechado. */
  intent: "success" | "info" | "error";
  title: string;
  details?: string;
  items?: string[];
  /** Ação oferecida na própria notificação, como "Desfazer"; usá-la fecha a notificação. */
  action?: { label: string; onClick: () => void };
  /** Ícone no lugar do padrão da intenção. */
  icon?: "trash";
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
