/**
 * The text of the user interface, in English. This catalogue gives the type
 * `Messages`, thus each other catalogue must hold the same keys.
 *
 * Each catalogue in `src/client/i18n/` is the only place for the text of its
 * language. The code of the components holds no text for the user.
 */
export const en = {
	appName: "airchive",
	tagline: "Every flight has a story",
	notFoundTitle: "Page not found",
	notFoundBack: "Go to the home page",

	signInLink: "Sign in",
	signInTitle: "Sign in to airchive",
	signInLead: "We send you a link. No password.",
	signInEmailLabel: "Email",
	signInSubmit: "Send me a link",
	signInSending: "Sending…",
	signInSentTitle: "Check your email",
	signInSentBody:
		"Open the link in the email to sign in. It expires in 15 minutes.",
	signInTooMany: "Too many requests. Try again in a minute.",
	signInInvalidEmail: "This email address is not valid.",
	signInFailed: "We could not send the link. Try again later.",
	linkInvalid: "This link is not valid or it expired. Ask for a new one.",

	signedInAs: "Signed in as",
	signOut: "Sign out",

	archiveTitle: "Your flights",
	archiveEmpty: "No flights yet. Add the first one.",
	archiveLoadFailed: "We could not load your flights. Try again later.",
	addFlight: "Add a flight",
	loading: "Loading…",

	newFlightTitle: "Add a flight",
	editFlightTitle: "Edit the flight",
	flightNotFound: "This flight does not exist.",
	backToArchive: "Back to your flights",
	backToFlight: "Back to the flight",

	fieldDesignator: "Flight",
	fieldDesignatorHint: "For example AZ 784",
	fieldAirlineName: "Airline (optional)",
	fieldOrigin: "From",
	fieldDestination: "To",
	fieldAirportHint: "City, airport or code",
	fieldDepartureDate: "Departure date",
	fieldDepartureTime: "Departure time (optional)",
	fieldArrivalDate: "Arrival date (optional)",
	fieldArrivalTime: "Arrival time (optional)",
	fieldSeat: "Seat (optional)",
	fieldCabinClass: "Class (optional)",
	fieldPassengerName: "Passenger name (optional)",
	fieldBookingReference: "Booking reference (optional)",

	cabinNone: "Not given",
	cabinEconomy: "Economy",
	cabinPremiumEconomy: "Premium economy",
	cabinBusiness: "Business",
	cabinFirst: "First",

	issueInvalid: "This value is not valid.",
	issueSameAirport: "The destination must be different from the origin.",
	issueArrivalBeforeDeparture: "The arrival cannot be before the departure.",
	issueUnknownAirport: "We do not know this airport. Choose one from the list.",

	saveFlight: "Save",
	saving: "Saving…",
	saveFailed: "We could not save the flight. Try again later.",
	deleteFlight: "Delete the flight",
	deleteConfirm: "Delete this flight? You cannot undo this.",
	deleteFailed: "We could not delete the flight. Try again later.",
	editFlight: "Edit",

	passTitle: "Boarding pass",
	passStub: "Stub",
	passTo: "to",
	passPassenger: "Passenger",
	passDate: "Date",
	passDeparts: "Departs",
	passArrives: "Arrives",
	passAirline: "Airline",
	passClass: "Class",
	passSeat: "Seat",
	passBooking: "Booking",
	passFlight: "Flight",
	passNoValue: "—",
};
