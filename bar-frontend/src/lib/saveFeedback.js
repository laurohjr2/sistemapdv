import { toast } from "sonner";
import { saveSuccessMessage } from "./saveFeedbackPolicy";
export function showSaveFeedback(response) {
  if (
    response.status < 200 ||
    response.status >= 300 ||
    response.data?.error ||
    response.data?.success === false
  )
    return;
  const message = saveSuccessMessage(response.config);
  if (!message) return;
  const username =
    response.config.url?.startsWith("/access/users/") &&
    response.data?.user?.username;
  toast.success(message, {
    id: "save-success",
    duration: 2000,
    className: "save-success-toast",
    description: username ? "Usuário: " + username : undefined,
  });
}
