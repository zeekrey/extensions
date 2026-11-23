import { showToast, Toast } from "@raycast/api";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function showError(title: string, error: unknown): Promise<void> {
  await showToast({
    style: Toast.Style.Failure,
    title,
    message: errorMessage(error),
  });
}
