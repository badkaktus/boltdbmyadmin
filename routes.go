package main

import (
	"bytes"
	"fmt"
	"github.com/boltdb/bolt"
	"github.com/gin-gonic/gin"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

var Db *bolt.DB

type Result struct {
	Result     string            `json:"result"`
	M          map[string]string `json:"m"`
	Pagination struct {
		CurrentPage int `json:"currentPage"`
		Total       int `json:"total"`
	} `json:"pagination"`
}

type DatabasesResult struct {
	Files       []string `json:"files"`
	ExecuteTime string   `json:"executeTime"`
}

func Index(c *gin.Context) {
	c.Redirect(301, "/web/index.html")
}

func CreateBucket(c *gin.Context) {
	if c.PostForm("bucket") == "" {
		c.String(200, "no bucket name | n")
	}
	err := Db.Update(func(tx *bolt.Tx) error {
		b, err := tx.CreateBucketIfNotExists([]byte(c.PostForm("bucket")))
		b = b
		if err != nil {
			return fmt.Errorf("create bucket: %s", err)
		}
		return nil
	})
	if err != nil {
		return
	}
	c.String(200, "ok")
}

func DeleteBucket(c *gin.Context) {
	if c.PostForm("bucket") == "" {
		c.String(200, "no bucket name | n")
	}
	Db.Update(func(tx *bolt.Tx) error {
		err := tx.DeleteBucket([]byte(c.PostForm("bucket")))
		if err != nil {
			c.String(200, "error no such bucket | n")
			return fmt.Errorf("bucket: %s", err)
		}
		return nil
	})
	c.String(200, "ok")
}

func DeleteKey(c *gin.Context) {
	if c.PostForm("bucket") == "" || c.PostForm("key") == "" {
		c.String(200, "no bucket name or key | n")
	}
	Db.Update(func(tx *bolt.Tx) error {
		b, err := tx.CreateBucketIfNotExists([]byte(c.PostForm("bucket")))
		b = b
		if err != nil {
			c.String(200, "error no such bucket | n")
			return fmt.Errorf("bucket: %s", err)
		}
		err = b.Delete([]byte(c.PostForm("key")))
		if err != nil {
			c.String(200, "error Deleting KV | n")
			return fmt.Errorf("delete kv: %s", err)
		}
		return nil
	})
	c.String(200, "ok")
}

func Put(c *gin.Context) {
	if c.PostForm("bucket") == "" || c.PostForm("key") == "" {
		c.String(200, "no bucket name or key | n")
	}
	Db.Update(func(tx *bolt.Tx) error {
		b, err := tx.CreateBucketIfNotExists([]byte(c.PostForm("bucket")))
		b = b
		if err != nil {
			c.String(200, "error  creating bucket | n")
			return fmt.Errorf("create bucket: %s", err)
		}
		err = b.Put([]byte(c.PostForm("key")), []byte(c.PostForm("value")))
		if err != nil {
			c.String(200, "error writing KV | n")
			return fmt.Errorf("create kv: %s", err)
		}
		return nil
	})
	c.String(200, "ok")
}

func Get(c *gin.Context) {
	res := []string{"nok", ""}
	if c.PostForm("bucket") == "" || c.PostForm("key") == "" {
		res[1] = "no bucket name or key | n"
		c.JSON(200, res)
	}
	Db.View(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte(c.PostForm("bucket")))
		if b != nil {
			v := b.Get([]byte(c.PostForm("key")))
			res[0] = "ok"
			res[1] = string(v)
			//fmt.Printf("Key: %s\n", v)
		} else {
			res[1] = "error opening bucket| does it exist? | n"
		}
		return nil
	})
	c.JSON(200, res)
}

func PrefixScan(c *gin.Context) {
	res := Result{Result: "nok"}
	res.M = make(map[string]string)
	if c.PostForm("bucket") == "" {
		res.Result = "no bucket name | n"
		c.JSON(200, res)
	}
	if c.PostForm("page") == "" {
		res.Pagination.CurrentPage = 0
	} else {
		res.Pagination.CurrentPage, _ = strconv.Atoi(c.PostForm("page"))
		res.Pagination.CurrentPage--
	}
	perPage := 25
	if c.PostForm("perPage") != "" {
		perPage, _ = strconv.Atoi(c.PostForm("perPage"))
	}
	fromKey := res.Pagination.CurrentPage * perPage
	toKey := fromKey + perPage
	count := 0
	if c.PostForm("key") == "" {
		Db.View(func(tx *bolt.Tx) error {
			// Assume bucket exists and has keys
			b := tx.Bucket([]byte(c.PostForm("bucket")))
			if b != nil {
				c := b.Cursor()
				for k, v := c.First(); k != nil; k, v = c.Next() {
					if count < fromKey {
						count++
						continue
					}

					if count >= toKey {
						break
					}

					res.M[string(k)] = string(v)
					count++
				}
				res.Result = "ok"
				res.Pagination.Total = b.Stats().KeyN
			} else {
				res.Result = "no such bucket available | n"
			}

			return nil
		})
	} else {
		Db.View(func(tx *bolt.Tx) error {
			// Assume bucket exists and has keys
			b := tx.Bucket([]byte(c.PostForm("bucket"))).Cursor()
			if b != nil {
				prefix := []byte(c.PostForm("key"))
				for k, v := b.Seek(prefix); bytes.HasPrefix(k, prefix); k, v = b.Next() {
					res.M[string(k)] = string(v)
					if count > 2000 {
						break
					}
					count++
				}
				res.Result = "ok"
			} else {
				res.Result = "no such bucket available | n"
			}
			return nil
		})
	}
	c.JSON(200, res)
}

func Buckets(c *gin.Context) {
	res := []string{}
	err := Db.View(func(tx *bolt.Tx) error {
		return tx.ForEach(func(name []byte, _ *bolt.Bucket) error {
			b := []string{string(name)}
			res = append(res, b...)
			return nil
		})
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, res)
}

func LoadDatabase(c *gin.Context) {
	dbFilepath := c.PostForm("filePath")

	if dbFilepath == "" {
		c.JSON(http.StatusInternalServerError, "file path not found")
		return
	}

	if _, err := os.Stat(dbFilepath); err != nil {
		c.JSON(http.StatusInternalServerError, "file doesn't exist")
		return
	}

	if Db != nil {
		err := Db.Close()
		if err != nil {
			c.JSON(http.StatusInternalServerError, err.Error())
			return
		}
	}

	var err error
	Db, err = bolt.Open(dbFilepath, 0600, &bolt.Options{Timeout: 2 * time.Second})

	if err != nil {
		fmt.Println("err:", err)
		c.JSON(http.StatusInternalServerError, err.Error())
		return
	}
	c.JSON(http.StatusOK, "ok")
}

func Databases(c *gin.Context) {
	res := DatabasesResult{}
	now := time.Now()
	defer func() {
		res.ExecuteTime = time.Since(now).String()
	}()

	e := filepath.Walk("./", func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() == true {
			return nil
		}
		if filepath.Ext(path) != ".db" {
			return nil
		}

		res.Files = append(res.Files, path)
		return nil
	})
	if e != nil {
		fmt.Printf("error: %s", e)
	}

	httpCode := http.StatusOK

	if len(res.Files) == 0 {
		httpCode = http.StatusNoContent
	}

	c.JSON(httpCode, res)
}
