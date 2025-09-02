import { createRoot } from "react-dom/client"
import "./style.scss"
import DecryptAuth from "./pages/Decrypt/Auth"
import DecryptLost from "./pages/Decrypt/Lost"
import DecryptText from "./pages/Decrypt/Text"
import EncryptText from "./pages/Encrypt/Text"
import EncryptAuth from "./pages/Encrypt/Auth"
import Home from "./pages/Home"
import Open from "./pages/Open"
// import Startup from "./pages/Startup"
import Redirect from "./components/Redirect"
import Router, { Route, Switch } from "crossroad"
import App from "./App"
import Toast from "./components/Toast"
import Confirm from "./components/Confirm"
import ProtectedRoute from "./components/ProtectedRoute"
import TestRoute from "./components/TestRoute"

const node = document.getElementById("root")
const root = createRoot(node)

// TODO: add splash screen on startup and send to "/". All references of path going to "/"
//       as it relates to opening a new file should be replace with "/open"

root.render(
	<App>
		<Router>
			<Switch>
				<Route path="/" component={Open} />
				<Route path="/open" component={Open} />
				<Route path="/decrypt/text" component={DecryptText} />
				<Route path="/decrypt/auth" component={DecryptAuth} />
				<Route path="/decrypt/lost" component={DecryptLost} />
				<Route path="/encrypt/text" component={EncryptText} />
				<Route path="/encrypt/auth" component={EncryptAuth} />
				<ProtectedRoute path="/home" component={Home} />
			</Switch>
			<Redirect />
		</Router>
		<Toast />
		<Confirm />
	</App>
)
