import path from "path";
import React from "react";
import ReactDOM from "react-dom";
import { RelayEnvironmentProvider } from "react-relay";

import environment from "../common/graphqlEnvironment";
import App from "./App";
import "./index.css";

ReactDOM.render(
  <React.StrictMode>
    <RelayEnvironmentProvider environment={environment}>
      <App />
    </RelayEnvironmentProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
