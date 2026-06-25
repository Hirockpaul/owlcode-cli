import { Children } from "react";
import { ThemeDialogContent, SessionsDialogContent } from "../dialogs";
import  type  {Command} from "./types";

export const COMMANDS: Command[] = [
     {
    name: "new",
    description: "Start a new conversation",
    value: "/new",
    action : (ctx) => {
      ctx.toast.show({message: "Starting a new conversation..."});
      
    }
  },
  {
    name: "agents",
    description: "Switch agents",
    value: "/agents",
    action : (ctx) => {
      ctx.dialog.open({
        title: "Select an Mode",
        children: <text>Agent selection coming soon...</text>
      })
    }
    },
  {
    name: "models",
    description: "Select AI model for generation",
    value: "/models",
    action : (ctx) => {
     ctx.dialog.open({
        title: "Select an Model",
        children: <text>Model selection coming soon...</text>
      })
      
    }
  },
  {
    name: "sessions",
    description: "Browse past sessions",
    value: "/sessions",
     action : (ctx) => {
      ctx.dialog.open({
        title: "Sessions",
        children:<SessionsDialogContent/>,
      });
    }  
  },
  {
    name: "theme",
    description: "Change color theme",
    value: "/theme",
     action : (ctx) => {
      ctx.dialog.open ({
        title:"Select Theme",
        children: <ThemeDialogContent />
      }) 
    }   
  },
  {
    name: "login",
    description: "Sign in with your browser",
    value: "/login",
     action : (ctx) => {
      ctx.toast.show({message: "Opening browser for sign-in..."});
      
    } 
  },
  {
    name: "logout",
    description: "Sign out of your account",
    value: "/logout",
     action : (ctx) => {
      ctx.toast.show({ variant: "success",message: "Signing out"});
      
    }
  },
  {
    name: "upgrade",
    description: "Buy more credits",
    value: "/upgrade",
     action : (ctx) => {
      ctx.toast.show({message: "Opening credits checkout ..."});    
    }
  },
  {
    name: "usage",
    description: "Open billing portal in your browser",
    value: "/usage",
     action : (ctx) => {
      ctx.toast.show({message: "Opening billing portal..."});
      
    }
  },
    {
        name: "new",
        description: "Start a new conversation",
        value: "/new",
    },

    {
        name: "exit",
        description: "Quit the application",
        value: "/exit",
        action :(ctx) => {
            ctx.exit();
        }
    },
]