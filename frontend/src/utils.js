/**
 * Attempts the function (async or sync) and returns tuple containing the results of that function.
 * Tuple is arranged in error-first format, meaning __`[error, data]`__. This convention is most common
 * within the JavaScript ecosystem, specfically in NodeJS. See a conversation about it here:
 * https://github.com/arthurfiorette/proposal-try-operator/issues/13
 *
 * @param {() => unknown} fx The function to attempt
 * @param {...any} xarg Any arguments you want to pass directly to the function being attempted
 * @returns {Promise<[Error, unknown]>}
 */
export async function _attempt(fx, ...xarg) {
	try {
		const data = await fx(...xarg)

		return [, data]
	} catch (err) {
		return [err]
	}
}

/**
 * A wrapper of the internal `attempt` function, specific to Imcrypt's API.
 *
 * @param {() => unknown} fx The function to attempt
 * @param {...any} xarg Any arguments you want to pass directly to the function being attempted
 * @returns {Promise<[Error, unknown]>}
 */
export async function attempt(fx, ...xarg) {
	const [err, data] = await _attempt(fx, ...xarg)

	if (data?.status === "ERROR") return [new Error(data.message), data.data]

	return [err, data?.data]
}

/**
 * Returns the grapheme count of the given string.
 *
 * @param {string} str The string to count graphemes
 * @returns {number}
 */
export function graphemeCount(str) {
	return [...new Intl.Segmenter().segment(str)].length
}

/**
 * Sorts a string per the given sort function
 *
 * @param {string} str The string to sort
 * @param {(a: any, b: any) => number} [sortFx] The function to pass directly to `.sort`
 * @returns {string}
 */
export function sortString(str, sortFx) {
	return [...new Intl.Segmenter().segment(str)]
		.map(s => s.segment)
		.sort(sortFx)
		.join("")
}
