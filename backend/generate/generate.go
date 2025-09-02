package generate

import (
	"fmt"
	"imcrypt_v3/backend/database"
	"imcrypt_v3/backend/utils"
	"slices"
	"strings"

	gonanoid "github.com/matoous/go-nanoid/v2"
)

// Generates a password string based on the given ruleset and charset
type ConstraintWithMap struct {
	Iterations int
	CharsetMap map[rune]bool
}

func Generate(ruleset database.Ruleset, previousPasswords []string) (string, error) {
	// Build the character map for the allowed characters. We'll use this
	// to validate at least constraints' character maps for disallowed characters
	accm := make(map[rune]bool)

	for _, r := range ruleset.Charset {
		accm[r] = true
	}

	// Build the character maps for the at most constraints. We'll use these
	// to validate at least constraints' character maps for too many characters
	amcm := []ConstraintWithMap{}

	for _, amc := range ruleset.AtMostConstraints {
		cm := make(map[rune]bool)

		for _, r := range amc.Charset {
			cm[r] = true
		}

		amcm = append(amcm, ConstraintWithMap{amc.Iterations, cm})
	}

	// Go through the at least constraints and build out character maps
	// representing every minimum combination of characters that must
	// appear in the resulting generated string.
	var blocks [][]*utils.String

	for _, alc := range ruleset.AtLeastConstraints {
		block := CalculateStarsAndBars(alc, accm)
		blocks = append(blocks, utils.ShuffleSlice(block))
	}

	if len(blocks) > 0 {
		blocks = utils.ShuffleSlice(blocks)

		var rec func(i int, buf *utils.String) (string, error)

		rec = func(i int, buf *utils.String) (string, error) {
			if i == len(blocks) {
				// Attempt generation with the supposed valid string
				return AttemptGeneration(buf, accm, ruleset.SameCharMax, ruleset.MinLength, ruleset.MaxLength, amcm, previousPasswords)
			}

			for j := 0; j < len(blocks[i]); j++ {
				m, err := MergeCandidates(buf, blocks[i][j], ruleset, amcm)
				if err != nil {
					continue
				}

				s, err := rec(i+1, m)
				if err == nil {
					return s, nil
				}
			}

			return "", fmt.Errorf("failed")
		}

		s, err := rec(0, utils.FromString(""))
		if err != nil {
			return "", fmt.Errorf("generation is impossible because the given constraints conflict with each other")
		}

		return s, nil
	}

	s, err := AttemptGeneration(utils.FromString(""), accm, ruleset.SameCharMax, ruleset.MinLength, ruleset.MaxLength, amcm, previousPasswords)
	if err != nil {
		return "", fmt.Errorf("failed to generate a string from the given constraints")
	}

	return s, nil
}

// Finds all of the stars and bars (https://en.wikipedia.org/wiki/Stars_and_bars_(combinatorics))
// Basically, for any string, what anagrammatically unique combinations can be made
// when allowing for repetition at the expected length? Given the string "abc" with
// a length of 2, the strings "aa", "bb", "cc", "ab", "ac", "bc" can all be derived,
// and "ba", "ca", "cb" can all be discarded as they, when rearranged, already exist
// within the list of results.
func CalculateStarsAndBars(alc database.IterationConstraint, accm map[rune]bool) []*utils.String {
	seen := make(map[string]bool)
	runes := []rune(alc.Charset)
	cur := make([]rune, 0, alc.Iterations)

	var (
		rec func(start, depth int)
		buf []*utils.String
	)

	rec = func(start, depth int) {
		if depth == alc.Iterations {
			slices.Sort(cur)
			raw := string(cur)

			if !seen[raw] {
				seen[raw] = true
				buf = append(buf, utils.FromString(raw))
			}

			return

		}

		for i := start; i < len(runes); i++ {
			if !accm[runes[i]] {
				return
			}

			cur = append(cur, runes[i])
			rec(i, depth+1)
			cur = cur[:len(cur)-1]
		}
	}

	rec(0, 0)

	return buf
}

// Merges two candidate strings
func MergeCandidates(ca, cb *utils.String, ruleset database.Ruleset, amcm []ConstraintWithMap) (*utils.String, error) {
	m := ca.Merge(cb)

	// Check if this string violates the same character max constraint (scm of 0 means it was unset)
	if ruleset.SameCharMax > 0 {
		for _, i := range m.Charmap {
			if i > ruleset.SameCharMax {
				return nil, fmt.Errorf("merge failed")
			}
		}
	}

	// Check if this string violates the at most constraints
	for _, amc := range amcm {
		b := 0

		for r := range amc.CharsetMap {
			b += m.Charmap[r]

			if b > amc.Iterations {
				return nil, fmt.Errorf("merge failed")
			}
		}
	}

	size := m.Size()

	// Check if this string violates size constraints
	if size > ruleset.MaxLength {
		return nil, fmt.Errorf("merge failed")
	}

	return m, nil
}

// Attempts to generate a string
func AttemptGeneration(base *utils.String, allowedCharmap map[rune]bool, sameCharMax, minLength, maxLength int, amcm []ConstraintWithMap, previousPasswords []string) (string, error) {
	var stt []int

	minLength = max(minLength, base.Size())

	for i := minLength; i <= maxLength; i++ {
		stt = append(stt, i)
	}

szloop:
	for _, sz := range stt {
		pool := GetCharPool(allowedCharmap, sameCharMax, amcm, base)

		for base.Size() < sz {
			if len(pool) == 0 {
				continue szloop
			}

			g, _ := gonanoid.Generate(pool, 1)

			for _, r := range g {
				base.Charmap[r]++
			}

			pool = GetCharPool(allowedCharmap, sameCharMax, amcm, base)
		}

		s := base.Build()

		for range min(len(s), 5) {
			s = utils.ShuffleString(s)

			if !slices.Contains(previousPasswords, s) {
				return s, nil
			}
		}

		return "", fmt.Errorf("failed to generate a string from the given constraints due to previous passwords")
	}

	return "", fmt.Errorf("failed to generate a string from the given constraints due to exhaustion")
}

// Returns a string representing all the runes that have not been exhausted by the given
// str and can still be used for generation
func GetCharPool(allowedCharmap map[rune]bool, sameCharMax int, amcm []ConstraintWithMap, s *utils.String) string {
	var sb strings.Builder

	usage := make(map[int]int)
	atBudget := make(map[int]bool)

	for i, amc := range amcm {
		b := 0

		for r, c := range s.Charmap {
			if amc.CharsetMap[r] {
				b += c

				if b >= amc.Iterations {
					atBudget[i] = true
					break
				}
			}
		}

		usage[i] = b
	}

mainloop:
	for r := range allowedCharmap {
		if sameCharMax > 0 && s.Charmap[r] >= sameCharMax {
			continue
		}

		for i, amc := range amcm {
			if atBudget[i] || amc.CharsetMap[r] && (usage[i]+1 > amc.Iterations) {
				continue mainloop
			}
		}

		sb.WriteRune(r)
	}

	return sb.String()
}
