import type { Messages } from "./messages.ts";

/**
 * The text of the user interface, in Italian. The type `Messages` makes a
 * missing key a compile error. The text uses the informal "tu", as the
 * English text speaks to the person directly.
 */
export const it: Messages = {
	appName: "airchive",
	tagline: "Ogni volo ha una storia",
	notFoundTitle: "Pagina non trovata",
	notFoundBack: "Vai alla pagina iniziale",

	signInLink: "Accedi",
	signInTitle: "Accedi ad airchive",
	signInLead: "Ti mandiamo un link. Nessuna password.",
	signInEmailLabel: "Email",
	signInSubmit: "Mandami il link",
	signInSending: "Invio in corso…",
	signInSentTitle: "Controlla la tua email",
	signInSentBody: "Apri il link nell'email per accedere. Scade tra 15 minuti.",
	signInTooMany: "Troppe richieste. Riprova tra un minuto.",
	signInInvalidEmail: "Questo indirizzo email non è valido.",
	signInFailed: "Non siamo riusciti a mandare il link. Riprova più tardi.",
	linkInvalid: "Questo link non è valido o è scaduto. Chiedine uno nuovo.",

	signedInAs: "Accesso come",
	signOut: "Esci",

	archiveTitle: "I tuoi voli",
	archiveEmpty: "Ancora nessun volo. Aggiungi il primo.",
	archiveLoadFailed:
		"Non siamo riusciti a caricare i tuoi voli. Riprova più tardi.",
	addFlight: "Aggiungi un volo",
	loading: "Caricamento…",

	newFlightTitle: "Aggiungi un volo",
	editFlightTitle: "Modifica il volo",
	flightNotFound: "Questo volo non esiste.",
	backToArchive: "Torna ai tuoi voli",
	backToFlight: "Torna al volo",

	fieldDesignator: "Volo",
	fieldDesignatorHint: "Per esempio AZ 784",
	fieldAirlineName: "Compagnia aerea (facoltativa)",
	fieldOrigin: "Da",
	fieldDestination: "A",
	fieldAirportHint: "Città, aeroporto o codice",
	fieldDepartureDate: "Data di partenza",
	fieldDepartureTime: "Ora di partenza (facoltativa)",
	fieldArrivalDate: "Data di arrivo (facoltativa)",
	fieldArrivalTime: "Ora di arrivo (facoltativa)",
	fieldSeat: "Posto (facoltativo)",
	fieldCabinClass: "Classe (facoltativa)",
	fieldPassengerName: "Nome del passeggero (facoltativo)",
	fieldBookingReference: "Codice di prenotazione (facoltativo)",

	cabinNone: "Non indicata",
	cabinEconomy: "Economy",
	cabinPremiumEconomy: "Premium economy",
	cabinBusiness: "Business",
	cabinFirst: "Prima",

	issueInvalid: "Questo valore non è valido.",
	issueSameAirport: "La destinazione deve essere diversa dalla partenza.",
	issueArrivalBeforeDeparture: "L'arrivo non può essere prima della partenza.",
	issueUnknownAirport:
		"Non conosciamo questo aeroporto. Scegline uno dalla lista.",

	saveFlight: "Salva",
	saving: "Salvataggio…",
	saveFailed: "Non siamo riusciti a salvare il volo. Riprova più tardi.",
	deleteFlight: "Elimina il volo",
	deleteConfirm: "Eliminare questo volo? Non si può annullare.",
	deleteFailed: "Non siamo riusciti a eliminare il volo. Riprova più tardi.",
	editFlight: "Modifica",

	passTitle: "Carta d'imbarco",
	passStub: "Tagliando",
	passTo: "a",
	passPassenger: "Passeggero",
	passDate: "Data",
	passDeparts: "Partenza",
	passArrives: "Arrivo",
	passAirline: "Compagnia",
	passClass: "Classe",
	passSeat: "Posto",
	passBooking: "Prenotazione",
	passFlight: "Volo",
	passNoValue: "—",
	passLogoTrademark:
		"Il logo della compagnia aerea è un marchio del suo proprietario.",

	tearToRelive: "Strappa per rivivere il volo",
	replayLabel: "Replay del volo",
	replayClose: "Chiudi il replay",
	replayPlay: "Avvia",
	replayPause: "Pausa",
	replayAgain: "Vola di nuovo",
	replayTimeline: "Avanzamento del volo",
	replaySpeed: "Velocità",
	replayMoreSpeeds: "Altre velocità",
	replayEstimated: "Durata stimata",
	speed15s: "15 s",
	speed30s: "30 s",
	speed1min: "1 min",
	speed5min: "5 min",
	speed4x: "4×",
	speed1x: "Tempo reale",
	inflightLabel: "Dati del volo",
	inflightDistance: "Distanza residua",
	inflightTime: "Tempo residuo",
	inflightEta: "ETA",
	inflightSpeed: "Velocità al suolo",
	inflightAltitude: "Altitudine",
	inflightSimulated: "Velocità e altitudine simulate",

	mapLabel: "Mappa della rotta",
	followAircraft: "Tieni l'aereo al centro della mappa",
	mapUnavailable: "La mappa non è disponibile al momento.",
	mapContributors: "e collaboratori",

	importPass: "Importa una carta d'imbarco",
	importHint:
		"Un file .pkpass, oppure uno screenshot o una foto del codice a barre.",
	importReading: "Lettura della carta d'imbarco…",
	importDone:
		"Abbiamo compilato il modulo dalla tua carta d'imbarco. Controlla ogni valore, poi salva.",
	importPrivacy:
		"Il file resta sul tuo dispositivo. Ad airchive arrivano solo i valori che salvi.",
	importFileTooLarge: "Questo file è troppo grande per una carta d'imbarco.",
	importNotAPass: "Questo file non è una carta d'imbarco né un'immagine.",
	importPdf:
		"Non possiamo leggere un PDF. Fai uno screenshot del codice a barre, poi importa lo screenshot.",
	importNoBarcode:
		"In questa immagine non c'è il codice a barre di una carta d'imbarco. Usa un'immagine nitida e dritta dell'intero codice.",
	importNotBoardingPass: "Questo pass non è la carta d'imbarco di un volo.",
	importNoFlightData:
		"In questo pass non abbiamo trovato nessun volo. Inserisci i dati a mano.",
};
