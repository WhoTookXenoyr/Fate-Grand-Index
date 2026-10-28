// Every /api/ address of Fate/Grand Index goes to server/app.js (Cloudflare Pages Functions).
import {handle} from "../../server/app.js";
export const onRequest = (ctx) => handle(ctx);
