import configFn from "../../config/environment.js";
export default configFn(import.meta.env.MODE || "development");
