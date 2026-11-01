package services

import (
	"fmt"
	"math"
	"strings"
	"unicode"

	"rapor-smk-backend/models"
)

type GradeService struct{}

func NewGradeService() *GradeService {
	return &GradeService{}
}

// cleanTpDescription removes common assessment prefixes entered by teachers
// and formats the first word properly for smooth narrative synthesis.
func cleanTpDescription(raw string) string {
	desc := strings.TrimSpace(raw)
	desc = strings.TrimRight(desc, ".")
	lower := strings.ToLower(desc)

	prefixes := []string{
		"menunjukkan penguasaan yang sangat baik dalam ",
		"menunjukkan penguasaan yang baik dalam ",
		"menunjukkan penguasaan dalam ",
		"peserta didik mampu ",
		"siswa mampu ",
		"dapat ",
		"mampu ",
	}

	for _, prefix := range prefixes {
		if strings.HasPrefix(lower, prefix) {
			desc = strings.TrimSpace(desc[len(prefix):])
			lower = strings.ToLower(desc)
		}
	}

	if len(desc) == 0 {
		return desc
	}

	words := strings.Fields(desc)
	if len(words) > 0 {
		firstWord := words[0]
		isAllUpper := len(firstWord) >= 2
		for _, r := range firstWord {
			if !unicode.IsUpper(r) && !unicode.IsDigit(r) {
				isAllUpper = false
				break
			}
		}
		if !isAllUpper && len(desc) > 1 {
			desc = strings.ToLower(desc[:1]) + desc[1:]
		}
	}

	return desc
}

// CalculateNilaiAkhir calculates the average score of all TP details
func (s *GradeService) CalculateNilaiAkhir(details []models.GradeDetail) float64 {
	if len(details) == 0 {
		return 0
	}

	var sum float64
	var count int
	var maxScore float64
	for _, d := range details {
		if d.Nilai > 0 {
			sum += d.Nilai
			count++
			if d.Nilai > maxScore {
				maxScore = d.Nilai
			}
		}
	}

	// In checkmark mode (where values are binary 1 or 0), do not calculate 1.0 as final grade.
	// Nilai Akhir is entered directly as 0-100 by the teacher.
	if count == 0 || maxScore <= 1.0 {
		return 0
	}

	avg := sum / float64(count)
	// Round to 2 decimal places
	return math.Round(avg*100) / 100
}

// GenerateDeskripsiCapaian generates Kurikulum Merdeka narrative competence description
// based on achieved/unachieved TP checkmarks or highest and lowest TP scores.
func (s *GradeService) GenerateDeskripsiCapaian(
	studentName string,
	details []models.GradeDetail,
	tpMap map[string]models.LearningObjective,
) string {
	if len(details) == 0 {
		return "Belum ada tujuan pembelajaran yang ditentukan untuk mata pelajaran ini."
	}

	type tpScore struct {
		kode      string
		deskripsi string
		nilai     float64
	}

	var allItems []tpScore
	var achieved []tpScore
	var unachieved []tpScore
	var maxScore float64

	for _, d := range details {
		tp, exists := tpMap[d.LearningObjectiveID]
		if !exists && d.LearningObjective != nil {
			tp = *d.LearningObjective
			exists = true
		}

		if exists {
			cleanDesc := cleanTpDescription(tp.Deskripsi)
			item := tpScore{
				kode:      tp.KodeTP,
				deskripsi: cleanDesc,
				nilai:     d.Nilai,
			}
			allItems = append(allItems, item)
			if d.Nilai > maxScore {
				maxScore = d.Nilai
			}

			// In checkmark mode (1 = tercapai, 0 = belum tercapai) or numeric (>= 75 = tercapai)
			if d.Nilai >= 1.0 {
				achieved = append(achieved, item)
			} else {
				unachieved = append(unachieved, item)
			}
		}
	}

	if len(allItems) == 0 {
		return "Belum ada tujuan pembelajaran yang ditentukan untuk mata pelajaran ini."
	}

	// -------------------------------------------------------------
	// 1. Binary Checkmark Mode (Values are 1 for Tercapai, 0 for Belum)
	// -------------------------------------------------------------
	if maxScore <= 1.0 {
		// All TPs achieved
		if len(unachieved) == 0 {
			if len(achieved) == 1 {
				return fmt.Sprintf("Menunjukkan penguasaan yang sangat baik dalam %s.", achieved[0].deskripsi)
			} else if len(achieved) == 2 {
				return fmt.Sprintf("Menunjukkan penguasaan yang sangat baik dalam %s dan %s.", achieved[0].deskripsi, achieved[1].deskripsi)
			} else if len(achieved) == 3 {
				return fmt.Sprintf("Menunjukkan penguasaan yang sangat baik dalam %s, %s, dan %s.", achieved[0].deskripsi, achieved[1].deskripsi, achieved[2].deskripsi)
			}
			return fmt.Sprintf("Menunjukkan penguasaan yang sangat baik dalam seluruh tujuan pembelajaran, terutama dalam %s dan %s.", achieved[0].deskripsi, achieved[1].deskripsi)
		}

		// None achieved (all unchecked)
		if len(achieved) == 0 {
			if len(unachieved) == 1 {
				return fmt.Sprintf("Perlu bimbingan dan peningkatan dalam %s.", unachieved[0].deskripsi)
			} else if len(unachieved) == 2 {
				return fmt.Sprintf("Perlu bimbingan dan peningkatan dalam %s serta %s.", unachieved[0].deskripsi, unachieved[1].deskripsi)
			} else if len(unachieved) == 3 {
				return fmt.Sprintf("Perlu bimbingan dan peningkatan dalam %s, %s, serta %s.", unachieved[0].deskripsi, unachieved[1].deskripsi, unachieved[2].deskripsi)
			}
			return fmt.Sprintf("Perlu bimbingan dan peningkatan dalam %s, %s, serta tujuan pembelajaran lainnya.", unachieved[0].deskripsi, unachieved[1].deskripsi)
		}

		// Mixed: Some achieved, some need guidance
		var highPart string
		if len(achieved) == 1 {
			highPart = fmt.Sprintf("Menunjukkan penguasaan yang baik dalam %s", achieved[0].deskripsi)
		} else if len(achieved) == 2 {
			highPart = fmt.Sprintf("Menunjukkan penguasaan yang baik dalam %s dan %s", achieved[0].deskripsi, achieved[1].deskripsi)
		} else {
			highPart = fmt.Sprintf("Menunjukkan penguasaan yang baik dalam %s serta %s", achieved[0].deskripsi, achieved[1].deskripsi)
		}

		var lowPart string
		if len(unachieved) == 1 {
			lowPart = fmt.Sprintf("perlu peningkatan dan bimbingan dalam %s", unachieved[0].deskripsi)
		} else if len(unachieved) == 2 {
			lowPart = fmt.Sprintf("perlu bimbingan dan peningkatan dalam %s serta %s", unachieved[0].deskripsi, unachieved[1].deskripsi)
		} else {
			lowPart = fmt.Sprintf("perlu bimbingan dan peningkatan dalam %s, %s, serta kompetensi lainnya", unachieved[0].deskripsi, unachieved[1].deskripsi)
		}

		return fmt.Sprintf("%s, serta %s.", highPart, lowPart)
	}

	// -------------------------------------------------------------
	// 2. Numeric Mode Fallback (Scores e.g. 70, 85, 95)
	// -------------------------------------------------------------
	var validScores []tpScore
	for _, item := range allItems {
		if item.nilai > 0 {
			validScores = append(validScores, item)
		}
	}

	if len(validScores) == 0 {
		return "Belum ada penilaian tujuan pembelajaran."
	}

	// Find highest and lowest
	highest := validScores[0]
	lowest := validScores[0]

	for _, item := range validScores[1:] {
		if item.nilai > highest.nilai {
			highest = item
		}
		if item.nilai < lowest.nilai {
			lowest = item
		}
	}

	// If only 1 TP
	if len(validScores) == 1 {
		if highest.nilai >= 85 {
			return fmt.Sprintf("Menunjukkan penguasaan yang sangat baik dalam %s.", highest.deskripsi)
		} else if highest.nilai >= 75 {
			return fmt.Sprintf("Menunjukkan penguasaan yang baik dalam %s.", highest.deskripsi)
		} else {
			return fmt.Sprintf("Cukup menguasai dalam %s, perlu pendampingan lebih lanjut.", highest.deskripsi)
		}
	}

	// If all scores are equal
	if highest.nilai == lowest.nilai {
		if highest.nilai >= 85 {
			return fmt.Sprintf("Menunjukkan penguasaan yang sangat optimal dan merata dalam seluruh tujuan pembelajaran, khususnya %s.", highest.deskripsi)
		} else if highest.nilai >= 75 {
			return fmt.Sprintf("Menunjukkan penguasaan yang baik dan merata dalam seluruh tujuan pembelajaran yang dipelajari.")
		} else {
			return fmt.Sprintf("Perlu bimbingan dan peningkatan secara menyeluruh dalam seluruh tujuan pembelajaran yang dipelajari.")
		}
	}

	// Differentiated: highest vs lowest
	var highPart string
	if highest.nilai >= 85 {
		highPart = fmt.Sprintf("Menunjukkan penguasaan yang sangat baik dalam %s", highest.deskripsi)
	} else if highest.nilai >= 75 {
		highPart = fmt.Sprintf("Menunjukkan penguasaan yang baik dalam %s", highest.deskripsi)
	} else {
		highPart = fmt.Sprintf("Cukup menguasai dalam %s", highest.deskripsi)
	}

	var lowPart string
	if lowest.nilai < 70 {
		lowPart = fmt.Sprintf("perlu bimbingan intensif dan peningkatan dalam %s", lowest.deskripsi)
	} else if lowest.nilai < 80 {
		lowPart = fmt.Sprintf("perlu peningkatan dan pemantapan dalam %s", lowest.deskripsi)
	} else {
		lowPart = fmt.Sprintf("dapat ditingkatkan lebih lanjut dalam %s", lowest.deskripsi)
	}

	return fmt.Sprintf("%s, serta %s.", highPart, lowPart)
}
