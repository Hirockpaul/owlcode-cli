import { Outlet } from "react-router";
import { ToastProvider } from "../providers/toast";
import { DialogProvider } from "../providers/dialog";
import { KeyboardLayerProvider } from "../providers/keyboard-layer";
import { ThemeProvider } from "../providers/theme";
import { ThemedRoot } from "./themed-root";

export function RootLayout () {
     return (
        <ThemeProvider>
          <KeyboardLayerProvider>
            <ToastProvider>
              <DialogProvider>
                <ThemedRoot>
                    <Outlet/>
                </ThemedRoot>
              </DialogProvider>
            </ToastProvider>
          </KeyboardLayerProvider>
        </ThemeProvider>
      );
}