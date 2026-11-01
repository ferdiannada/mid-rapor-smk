package routes

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
	"rapor-smk-backend/config"
	"rapor-smk-backend/controllers"
	"rapor-smk-backend/middleware"
	"rapor-smk-backend/models"
)

func SetupRouter(cfg *config.Config) *gin.Engine {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Set trusted proxies so c.ClientIP() gets actual client IP behind reverse proxy
	_ = router.SetTrustedProxies([]string{
		"127.0.0.1",
		"::1",
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
	})

	// Apply CORS
	router.Use(middleware.CORSMiddleware(cfg))

	// Apply Traffic & Concurrency Rate Limiter (60 req/s, burst 100 per client IP)
	router.Use(middleware.RateLimitMiddleware(rate.Limit(60), 100))

	// Health check
	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"app":     cfg.AppName,
			"version": "1.0.0",
		})
	})

	// Ultra-lightweight heartbeat ping for offline/online client detection (zero-body 204)
	router.GET("/api/v1/ping", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	router.HEAD("/api/v1/ping", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	authCtrl := controllers.NewAuthController(cfg)
	dapodikConfigCtrl := controllers.NewDapodikConfigController(cfg)
	syncCtrl := controllers.NewSyncController()
	semesterCtrl := controllers.NewSemesterController()
	dataMasterCtrl := controllers.NewDataMasterController()
	tpCtrl := controllers.NewLearningObjectiveController()
	dashboardCtrl := controllers.NewDashboardController()
	gradeCtrl := controllers.NewGradeController()
	waliKelasCtrl := controllers.NewWaliKelasController()
	reportCtrl := controllers.NewReportController()
	adminMasterCtrl := controllers.NewAdminMasterController()
	schoolCtrl := controllers.NewSchoolController()

	v1 := router.Group("/api/v1")
	{
		// Public Auth
		authGroup := v1.Group("/auth")
		{
			authGroup.POST("/login", authCtrl.Login)
		}

		// Authenticated Routes
		authMiddleware := middleware.AuthMiddleware(cfg)

		protected := v1.Group("")
		protected.Use(authMiddleware)
		protected.Use(middleware.IdempotencyMiddleware())
		{
			// Auth Profile & Password
			protected.GET("/auth/me", authCtrl.GetMe)
			protected.POST("/auth/change-password", authCtrl.ChangePassword)

			// Dashboard Stats
			protected.GET("/dashboard/stats", dashboardCtrl.GetStats)

			// Semesters (Viewable by all, editable by admin)
			protected.GET("/semesters", semesterCtrl.ListSemesters)

			// Profil Identitas Sekolah (Viewable by all authenticated users for reports)
			protected.GET("/school-profile", schoolCtrl.GetProfile)

			// Master Data (Rombels, Students, Subjects, Assignments)
			protected.GET("/rombels", dataMasterCtrl.GetRombels)
			protected.GET("/rombels/:id/students", dataMasterCtrl.GetRombelStudents)
			protected.GET("/subjects", dataMasterCtrl.GetSubjects)
			protected.GET("/subject-groups/summary", adminMasterCtrl.GetSubjectGroupsSummary)
			protected.GET("/teaching-assignments", dataMasterCtrl.GetTeachingAssignments)
			protected.GET("/teaching-assignments/my", dataMasterCtrl.GetMyTeachingAssignments)

			// Learning Objectives (TP)
			protected.GET("/subjects/:id/learning-objectives", tpCtrl.GetBySubject)
			protected.POST("/subjects/:id/learning-objectives", tpCtrl.Create)
			protected.PUT("/learning-objectives/:id", tpCtrl.Update)
			protected.DELETE("/learning-objectives/:id", tpCtrl.Delete)

			// Grades (Input Nilai Formatif & Sumatif TP)
			protected.GET("/grades/:rombel_id/:subject_id", gradeCtrl.GetGradesByRombelAndSubject)
			protected.POST("/grades/batch", gradeCtrl.BatchSaveGrades)
			protected.POST("/grades/generate-descriptions", gradeCtrl.GenerateAutoDescriptions)

			// Wali Kelas & Rekap Nilai
			protected.GET("/wali-kelas/:rombel_id/recap", waliKelasCtrl.GetRecap)
			protected.GET("/attendance/:rombel_id", waliKelasCtrl.GetAttendance)
			protected.POST("/attendance/batch", waliKelasCtrl.BatchSaveAttendance)
			protected.GET("/extracurriculars/:rombel_id", waliKelasCtrl.GetExtracurriculars)
			protected.POST("/extracurriculars", waliKelasCtrl.SaveExtracurricular)
			protected.DELETE("/extracurriculars/:id", waliKelasCtrl.DeleteExtracurricular)
			protected.GET("/wali-notes/:rombel_id", waliKelasCtrl.GetWaliNotes)
			protected.POST("/wali-notes/batch", waliKelasCtrl.BatchSaveWaliNotes)

			// Progress Input Nilai
			protected.GET("/dashboard/grade-progress", reportCtrl.GetGradeProgress)

			// Rapor Siswa & Cetak PDF / ZIP
			protected.GET("/reports/:student_id/preview", reportCtrl.GetStudentReportPreview)
			protected.GET("/reports/:student_id/html", reportCtrl.GetStudentReportHTML)
			protected.GET("/reports/:student_id/pdf", reportCtrl.GetStudentReportPDF)
			protected.GET("/reports/rombel/:rombel_id/zip", reportCtrl.GetRombelReportZip)

			// Admin Only
			adminOnly := protected.Group("/admin")
			adminOnly.Use(middleware.RoleMiddleware(models.RoleAdmin))
			{
				// Dapodik Configuration & Sync
				adminOnly.GET("/dapodik/config", dapodikConfigCtrl.GetConfig)
				adminOnly.GET("/dapodik/configs", dapodikConfigCtrl.GetAllConfigs)
				adminOnly.POST("/dapodik/config", dapodikConfigCtrl.SaveConfig)
				adminOnly.POST("/dapodik/configs/:id/activate", dapodikConfigCtrl.ActivateConfig)
				adminOnly.DELETE("/dapodik/configs/:id", dapodikConfigCtrl.DeleteConfig)
				adminOnly.POST("/dapodik/test-connection", dapodikConfigCtrl.TestConnection)
				adminOnly.POST("/dapodik/sync", syncCtrl.SyncDapodik)

				// Semester Management
				adminOnly.POST("/semesters", semesterCtrl.CreateSemester)
				adminOnly.PUT("/semesters/:id/activate", semesterCtrl.ActivateSemester)
				adminOnly.DELETE("/semesters/:id", semesterCtrl.DeleteSemester)

				// Master Data Management (Manual Override)
				// 1. Siswa (Peserta Didik)
				adminOnly.POST("/students", adminMasterCtrl.CreateStudent)
				adminOnly.PUT("/students/:id", adminMasterCtrl.UpdateStudent)
				adminOnly.PUT("/students/:id/transfer", adminMasterCtrl.TransferStudentRombel)
				adminOnly.DELETE("/students/:id", adminMasterCtrl.DeleteStudent)

				// 2. Guru & PTK
				adminOnly.GET("/teachers", adminMasterCtrl.GetTeachers)
				adminOnly.POST("/teachers", adminMasterCtrl.CreateTeacher)
				adminOnly.PUT("/teachers/:id", adminMasterCtrl.UpdateTeacher)
				adminOnly.POST("/teachers/:id/reset-password", adminMasterCtrl.ResetTeacherPassword)
				adminOnly.DELETE("/teachers/:id", adminMasterCtrl.DeleteTeacher)

				// 3. Rombel & Wali Kelas
				adminOnly.POST("/rombels", adminMasterCtrl.CreateRombel)
				adminOnly.PUT("/rombels/:id/wali-kelas", adminMasterCtrl.SetWaliKelas)

				// 4. Penugasan Mengajar
				adminOnly.POST("/teaching-assignments", adminMasterCtrl.CreateTeachingAssignment)
				adminOnly.DELETE("/teaching-assignments/:id", adminMasterCtrl.DeleteTeachingAssignment)

				// 5. Mata Pelajaran (Manual)
				adminOnly.POST("/subjects", adminMasterCtrl.CreateSubject)
				adminOnly.PUT("/subjects/reorder", adminMasterCtrl.ReorderSubjects)
				adminOnly.PUT("/subjects/bulk-kelompok", adminMasterCtrl.BulkUpdateSubjectKelompok)
				adminOnly.PUT("/subjects/:id", adminMasterCtrl.UpdateSubject)
				adminOnly.DELETE("/subjects/:id", adminMasterCtrl.DeleteSubject)

				// 6. Kelompok Mata Pelajaran
				adminOnly.POST("/subject-groups", adminMasterCtrl.CreateSubjectGroup)
				adminOnly.PUT("/subject-groups/reorder", adminMasterCtrl.ReorderSubjectGroups)
				adminOnly.PUT("/subject-groups/:kode", adminMasterCtrl.UpdateSubjectGroup)
				adminOnly.DELETE("/subject-groups/:kode", adminMasterCtrl.DeleteSubjectGroup)

				// 7. Pengelolaan Identitas Sekolah
				adminOnly.PUT("/school-profile", schoolCtrl.UpdateProfile)
				adminOnly.POST("/school-profile/logo", schoolCtrl.UploadLogo)
			}
		}
	}

	return router
}
