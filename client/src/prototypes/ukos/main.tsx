import { createRoot } from "react-dom/client";
import Prototype from "./Prototype";
import "@xterm/xterm/css/xterm.css";
import "./prototype.css";

const element = document.getElementById("root");
if (element) createRoot(element).render(<Prototype />);
