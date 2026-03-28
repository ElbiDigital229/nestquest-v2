import { useToast } from "@/hooks/use-toast"
import { CheckCircle2 } from "lucide-react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isSuccess = variant !== "destructive";
        return (
          <Toast
            key={id}
            variant={variant}
            className={isSuccess ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" : ""}
            {...props}
          >
            <div className="flex items-start gap-3">
              {isSuccess && (
                <div className="flex-shrink-0 mt-0.5">
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>
              )}
              <div className="grid gap-1">
                {title && <ToastTitle className={isSuccess ? "text-green-800 dark:text-green-200" : ""}>{title}</ToastTitle>}
                {description && (
                  <ToastDescription className={isSuccess ? "text-green-700 dark:text-green-300" : ""}>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
