/** An airport of the dataset, as the API gives it. */
export type Airport = {
	iata: string;
	name: string;
	city: string;
	country: string;
	lat: number;
	lon: number;
	tz: string;
};
