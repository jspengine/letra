export function cn(...classes: (string | false | null | undefined)[]): string {
	const seen = new Set<string>();
	return classes
		.filter(Boolean)
		.flatMap((c) => (c as string).split(" "))
		.filter((c) => {
			if (seen.has(c)) return false;
			seen.add(c);
			return true;
		})
		.join(" ");
}
