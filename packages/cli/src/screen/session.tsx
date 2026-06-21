import { SessionShell } from "../components/session-shell";
import { useParams,useNavigate, useLocation } from "react-router";
import { useState,useEffect,useMemo } from "react";
import {z} from "zod"
import type { InferResponseType } from "hono/client";


export function Session() {
    return <SessionShell onSubmit={() => {}} inputDisabled loading />

}
