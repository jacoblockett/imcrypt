package utils

import "strings"

// A string representation that doesn't care about the order of characters, just the
// characters themselves. Only really useful in the generation algorithm.
type String struct {
	Charmap map[rune]int
}

// Creates a String struct from a string literal (e.g. "abc")
func FromString(str string) *String {
	s := String{}
	cm := make(map[rune]int)

	for _, r := range str {
		cm[r]++
	}

	s.Charmap = cm

	return &s
}

// Creates a String struct from a character map (e.g. map[rune]int)
func FromCharmap(charmap map[rune]int) *String {
	cm := make(map[rune]int, len(charmap))

	for r, i := range charmap {
		cm[r] = i
	}

	return &String{cm}
}

// Builds the charset into a string
func (s *String) Build() string {
	var b strings.Builder

	for r, i := range s.Charmap {
		for range i {
			b.WriteRune(r)
		}
	}

	return b.String()
}

// Gets the length or size of the string
func (s *String) Size() int {
	i := 0

	for _, c := range s.Charmap {
		i += c
	}

	return i
}

// Compares two Strings together, returning true if they contain the same
// characters with the same iterations
func (s1 *String) CompareString(s2 *String) bool {
	if len(s1.Charmap) != len(s2.Charmap) {
		return false
	}

	for a, b := range s1.Charmap {
		if c, e := s2.Charmap[a]; !e || c != b {
			return false
		}
	}

	return true
}

// Merges two Strings together. Strings are merged by taking the maximum character count
// for each rune present in either String. The result is a new String that contains
// the highest frequency of each character from both source Strings, preserving the
// most occurrences without summing duplicates.
func (s1 *String) Merge(s2 *String) *String {
	s3 := FromCharmap(s1.Charmap)

	for r, i := range s2.Charmap {
		if v, e := s1.Charmap[r]; e {
			m := max(i, v)
			s3.Charmap[r] = m
		} else {
			s3.Charmap[r] = i
		}
	}

	return s3
}
