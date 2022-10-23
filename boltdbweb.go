// boltdbweb is a webserver base GUI for interacting with BoltDB databases.
//
// For authorship see https://github.com/evnix/boltdbweb
// MIT license is included in repository
package main

//go:generate go-bindata-assetfs -o web_static.go web/...

import (
	"flag"
	"fmt"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
	"net/http"
	"os"
	"path"

	"github.com/boltdb/bolt"
	log "github.com/sirupsen/logrus"
)

const version = "v0.0.0"

var (
	showHelp   bool
	db         *bolt.DB
	dbName     string
	port       string
	staticPath string
)

func usage(appName, version string) {
	fmt.Printf("Usage: %s [OPTIONS] [DB_NAME]", appName)
	fmt.Printf("\nOPTIONS:\n\n")
	flag.VisitAll(func(f *flag.Flag) {
		if len(f.Name) > 1 {
			fmt.Printf("    -%s, -%s\t%s\n", f.Name[0:1], f.Name, f.Usage)
		}
	})
	fmt.Printf("\n\nVersion %s\n", version)
}

func init() {
	// Read the static path from the environment if set.
	dbName = os.Getenv("BOLTDBWEB_DB_NAME")
	port = os.Getenv("BOLTDBWEB_PORT")
	// Use default values if environment not set.
	if port == "" {
		port = "8080"
	}
	// Setup for command line processing
	flag.BoolVar(&showHelp, "h", false, "display help")
	flag.BoolVar(&showHelp, "help", false, "display help")
}

func setupRouter() *gin.Engine {
	r := gin.Default()

	r.GET("/ping", func(c *gin.Context) {
		c.String(http.StatusOK, "pong")
	})

	r.Use(static.Serve("/", static.LocalFile("./www/build", false)))
	r.GET("/buckets", Buckets)
	r.GET("/database", Databases)
	r.POST("/createBucket", CreateBucket)
	r.POST("/put", Put)
	r.POST("/get", Get)
	r.POST("/delete-key", DeleteKey)
	r.POST("/delete-bucket", DeleteBucket)
	r.POST("/get-bucket-data", PrefixScan)
	r.POST("/load-database", LoadDatabase)

	return r
}

func main() {
	appName := path.Base(os.Args[0])
	flag.Parse()

	if showHelp == true {
		usage(appName, version)
		os.Exit(0)
	}

	log.Info("starting boltdb-browser..")

	r := setupRouter()

	err := r.Run(":" + port)
	if err != nil {
		log.Errorf("could not start gin. error: %s", err.Error())
		return
	}
}
