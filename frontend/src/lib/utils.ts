type ClassValue = string | undefined | null | false | 0;

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(" ");
}
