import React from "react";
import ReactDOM from "react-dom/client";

import Picker from "./Picker";
import Root from "./Root";
import "./App.css";
import { blockBrowserBehavior } from "./browserBehavior";

blockBrowserBehavior();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root transparent>
      <Picker />
    </Root>
  </React.StrictMode>,
);
