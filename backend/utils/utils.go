package utils

import (
	"bytes"
	"encoding/base64"
	"encoding/gob"
	"io"
	"math/rand"
	"net/http"
	"slices"
	"strings"
)

// Gobifies the given struct into a binary
func Gobify(s any) ([]byte, error) {
	var buf bytes.Buffer

	encoder := gob.NewEncoder(&buf)

	if err := encoder.Encode(s); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

// Degobifies the given data into the given interface
func Degob(data []byte, i any) error {
	reader := bytes.NewReader(data)
	decoder := gob.NewDecoder(reader)
	if err := decoder.Decode(i); err != nil {
		return err
	}

	return nil
}

// Signs the given data
func Sign(data, signature []byte) []byte {
	return append(signature, data...)
}

// Unsigns the given data
func Unsign(s, signature []byte) []byte {
	if bytes.HasPrefix(s, signature) {
		return s[len(signature):]
	}

	return s
}

// Deduplicates a string
func DedupeString(s string) string {
	var b strings.Builder

	b.Grow(len(s))

	seen := make(map[rune]bool)

	for _, r := range s {
		if !seen[r] {
			seen[r] = true
			b.WriteRune(r)
		}
	}

	return b.String()
}

// Shuffles the individual runes within a string
func ShuffleString(s string) string {
	if len(s) == 0 {
		return s
	}

	// Convert to rune slice for Unicode support
	runes := []rune(s)

	// Fisher-Yates shuffle
	for i := len(runes) - 1; i > 0; i-- {
		j := rand.Intn(i + 1)
		runes[i], runes[j] = runes[j], runes[i]
	}

	return string(runes)
}

// Sorts the individual runes within a string in forward order
func SortString(s string) string {
	runes := []rune(s)
	slices.Sort(runes)

	return string(runes)
}

// Removes any runes found in the given []rune in the given string
func RemoveRunesFromString(s string, rs []rune) string {
	var b strings.Builder

	b.Grow(len(s))

	for _, r := range s {
		if !slices.Contains(rs, r) {
			b.WriteRune(r)
		}
	}

	return b.String()
}

// Shuffles each item within a slice using rand.Shuffle (Fischer-Yates, I think)
func ShuffleSlice[T any](s []T) []T {
	rand.Shuffle(len(s), func(i, j int) {
		s[i], s[j] = s[j], s[i]
	})

	return s
}

// Merges all strings between strings a and b, discarding any already-seen anagrams.
// Returns the smallest strings found.
func MergeStringSlices(a, b []string) []string {
	if len(a) == 0 {
		return b
	} else if len(b) == 0 {
		return a
	}

	cans := []string{}            // candidates
	seen := make(map[string]bool) // seen anagrams

	// merge all strings between a and b, discarding any seen anagrams,
	// as well as any string longer than those already in the list
	for _, s1 := range a {
		for _, s2 := range b {
			m := MergeStrings(s1, s2)
			sorted := SortString(m)

			if !seen[sorted] {
				if len(cans) > 0 {
					cl := len(cans[0])
					nl := len(m)

					if cl > nl {
						cans = []string{m}
						seen[sorted] = true
					} else if cl == nl {
						cans = append(cans, m)
						seen[sorted] = true
					}
				} else {
					cans = append(cans, m)
					seen[sorted] = true
				}
			}

		}
	}

	return cans
}

// Merges strings a and b together. A merged string will take a as its primary string,
// compare it with all runes within b, merge like runes, and append unlike runes. For
// example, "abc" and "bcd" will result in "abcd", rather than "abcbcd" or "abbccd", etc.
// Another example, "abc" and "bccd" will result in "abccd", because 'c' appears twice in
// string b, the first 'c' is culled as a merge with string a, and the second 'c' is appended
// since it did not already exist within string a.
func MergeStrings(a, b string) string {
	cm := make(map[rune]int)

	for _, r := range a {
		cm[r]++
	}

	res := a

	for _, r := range b {
		if cm[r] > 0 {
			cm[r]--
		} else {
			res += string(r)
		}
	}

	return res
}

// Will get all variants of a given string at the given length. For example,
// "abc" with a length of 2 will give ["aa", "ab", "ac", etc]. The resulting []string
// will have all anagrammatically identical strings skipped, resulting in only
// unique multicombinations.
func GetMulticombinations(s string, length int) []string {
	res := []string{}
	runes := []rune(s)
	cur := make([]rune, 0, length)
	seen := make(map[string]bool)

	var re func(start, depth int)

	re = func(start, depth int) {
		if depth == length {
			curStr := string(cur)
			sorted := SortString(curStr)

			if !seen[sorted] {
				seen[sorted] = true
				res = append(res, string(cur))
			}

			return
		}

		for i := start; i < len(runes); i++ {
			cur = append(cur, runes[i])
			re(i, depth+1)
			cur = cur[:len(cur)-1]
		}
	}

	re(0, 0)
	return res
}

// Iterates over a slice and evaluates if the given callback returns true for any item.
func Any[T any](s []T, c func(v T, i int) bool) bool {
	for i, v := range s {
		if c(v, i) {
			return true
		}
	}

	return false
}

// Fetches an image from a URL and returns its base64 encoding
func FetchImageBase64FromURL(url string) (string, error) {
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return base64.StdEncoding.EncodeToString(data), nil
}
