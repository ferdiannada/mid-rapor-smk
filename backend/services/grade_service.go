package services

import (
	"fmt"
	"math"
	"strings"

	"rapor-smk-backend/models"
)

type GradeService struct{}

func NewGradeService() *GradeService {
	return &GradeService{}
}

// CalculateNilaiAkhir calculates the average score of all TP details
func (s *GradeService) CalculateNilaiAkhir(details []models.GradeDetail) float64 {
	if len(details) == 0 {
		return 0
	}

	var sum float64
	var count int
	for _, d := range details {
		if d.Nilai > 0 {
			sum += d.Nilai
			count++
		}
	}

	if count == 0 {
		return 0
	}

	avg := sum / float64(count)
	// Round to 2 decimal places
	return math.Round(avg*100) / 100
}

// GenerateDeskripsiCapaian generates Kurikulum Merdeka narrative competence description
// based on highest and lowest TP scores.
func (s *GradeService) GenerateDeskripsiCapaian(
	studentName string,
	details []models.GradeDetail,
	tpMap map[string]models.LearningObjective,
) string {
	if len(details) == 0 {
		return "Belum ada penilaian tujuan pembelajaran."
	}

	type tpScore struct {
		kode      string
		deskripsi string
		nilai     float64
	}

	var validScores []tpScore
	for _, d := range details {
		tp, exists := tpMap[d.LearningObjectiveID]
		if !exists && d.LearningObjective != nil {
			tp = *d.LearningObjective
			exists = true
		}

		if exists && d.Nilai > 0 {
			cleanDesc := strings.TrimSpace(tp.Deskripsi)
			// Lowercase first letter if appropriate for embedding in sentence
			if len(cleanDesc) > 1 {
				cleanDesc = strings.ToLower(cleanDesc[:1]) + cleanDesc[1:]
			}
			validScores = append(validScores, tpScore{
				kode:      tp.KodeTP,
				deskripsi: cleanDesc,
				nilai:     d.Nilai,
			})
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
