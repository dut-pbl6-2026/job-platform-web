import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { MOCKS_ENABLED } from "./lib/config";
import "./styles/fonts.css";
import "./styles/tokens.css"; // tokens and base rules first: everything below reads them
import "./styles/ui.css"; // shared components (.jp-*)
import "./styles/board.css";
import "./styles/detail.css";
import "./styles/apply.css";
import "./styles/authform.css";
import "./styles/account.css";
import "./styles/admin.css";
import "./styles/chat.css";
import "./styles/toast.css";
import "./styles/footer.css";

// Older builds fell back to localStorage mocks on every API error and kept the user's profile there in
// plain text (phone, address, date of birth), plus applications, admin data and chat history. With mocks
// off nothing reads these keys any more: remove them so the PII does not stay in the browser.
if (!MOCKS_ENABLED) {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("jp.mock.")) localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable (blocked cookies / private mode): nothing to clean */
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
