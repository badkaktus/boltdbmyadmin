import './App.css';
import axios from "axios";
import {
    CloseCircleOutlined,
    DeleteOutlined,
    EditOutlined,
    FileAddOutlined,
    PlusCircleOutlined,
    SaveOutlined
} from '@ant-design/icons';
import {
    Button,
    Col,
    Empty,
    Input,
    Layout,
    List,
    Menu,
    notification,
    Pagination,
    Popconfirm,
    Row,
    Select,
    Spin,
    Switch,
    Tooltip,
    Typography
} from 'antd';
import React from 'react';
import 'antd/dist/antd.css';
import _ from 'lodash';
import {JSONTree} from 'react-json-tree';

const {Header, Content, Sider} = Layout;
const {Search} = Input;

const theme = {
    scheme: 'atelier heath',
    author: 'bram de haan (http://atelierbram.github.io/syntax-highlighting/atelier-schemes/heath)',
    base00: '#1b181b',
    base01: '#292329',
    base02: '#695d69',
    base03: '#776977',
    base04: '#9e8f9e',
    base05: '#ab9bab',
    base06: '#d8cad8',
    base07: '#f7f3f7',
    base08: '#ca402b',
    base09: '#a65926',
    base0A: '#bb8a35',
    base0B: '#379a37',
    base0C: '#159393',
    base0D: '#516aec',
    base0E: '#7b59c0',
    base0F: '#cc33cc'
};

function showNotification(type, title, description) {
    notification[type]({
        message: title,
        description: description,
        placement: "bottomRight",
        duration: 7
    })
}

function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

class App extends React.Component {
    constructor(props) {
        super(props);
        this.timeoutId = 0;
        this.pageSize = 25;
        this.state = {
            buckets: [],
            selectedBucket: {},
            loadedDataFromBucket: {},
            allToJSON: false,
            toJSON: {},
            editData: {},
            filterKeyString: "",
            showLoader: false,
            pagination: {},
            perPage: 25,
            currentPage: 1,
            dbs: [],
            selectedDatabase: "",
            loaderDB: false
        };
    }

    componentDidMount() {
        this.loadDatabases()
    }

    loadDatabases = () => {
        this.setState({
            loaderDB: true
        })
        axios.get('/database')
            .then(({status, data}) => {
                if (status === 200) {
                    const options = _.map(data.files, (item) => {
                        return {
                            label: item,
                            value: item
                        }
                    })
                    let selectedDatabase = "";
                    if (_.size(options) > 0) {
                        selectedDatabase = _.head(options)
                    }
                    this.setState({
                        dbs: options,
                        selectedDatabase
                    })
                    this.loadDB(selectedDatabase.value)
                }
            })
            .finally(() => {
                this.setState({
                    loaderDB: false
                })
            })
    }

    loadDB = (dbPath) => {
        const formData = new FormData();
        formData.append("filePath", dbPath)
        axios.post('/load-database', formData)
            .then(({data, status}) => {
                if (status === 200) {
                    this.loadBucket()
                    this.setState({
                        selectedDatabase: {
                            label: dbPath,
                            value: dbPath
                        },
                        loadedDataFromBucket: {},
                        selectedBucket: {}
                    })
                }
            })
            .catch((err) => {
                showNotification("error", "Load DB error", `${err.message}\n${err.response.data}`)
            })
    }

    loadBucket = () => {
        axios.get('/buckets').then(({data}) => {
            let buckets = []
            buckets = data.map((val, key) => {
                return {label: val, key: `key${key}`}
            }, data)

            buckets.push({
                label: <Search
                    placeholder="Create bucket"
                    onSearch={(val) => this.createBucket(val)}
                    enterButton={<PlusCircleOutlined/>}/>,
                key: "key-search",
                disabled: true,
            })

            this.setState({buckets})

            setTimeout(() => {
                if (_.size(buckets) > 0) {
                    const firstBucket = _.head(buckets)
                    this.selectBucket(firstBucket.key)
                }
            }, 300)
        })
    }

    createBucket = (name) => {
        if (name.length === 0) {
            showNotification("error", "Error", "Try to create bucket without a name")
            return;
        }
        let formData = new FormData();
        formData.append("bucket", name)

        axios.post('/createBucket', formData)
            .then(({data, status}) => {
                if (data === "ok" && status === 200) {
                    let {buckets} = this.state

                    let searchItem = _.last(buckets),
                        indexForNewBucket = _.lastIndexOf(buckets, searchItem),
                        newBucket = {label: name, key: `key${buckets.length}`};

                    buckets[indexForNewBucket] = newBucket;
                    buckets = _.sortBy(buckets, [function (item) {
                        return item.label;
                    }])
                    buckets.push(searchItem)

                    this.setState({
                        buckets,
                        selectedBucket: newBucket
                    })
                }
            })
    }

    selectBucket = (key) => {
        let bucket = _.find(this.state.buckets, {key})

        if (_.isUndefined(bucket)) {
            console.log("unknown bucket")
            return
        }
        this.setState({
            selectedBucket: bucket,
            editData: {},
            toJSON: {},
            showLoader: true
        })

        this.loadDataFromBucket(bucket.label)
    }

    deleteBucket = () => {
        if (_.size(this.state.selectedBucket) === 0) {
            console.log("bucket doesnt select");
            return;
        }

        let formData = new FormData();
        formData.append("bucket", this.state.selectedBucket.label)

        axios.post("/delete-bucket", formData)
            .then(({data, status}) => {
                if (data === "ok" && status === 200) {
                    let {buckets} = this.state
                    let newBucketList = _.filter(buckets, (item) => item.label !== this.state.selectedBucket.label)

                    showNotification("success", "Deleted", `Bucket with label "${this.state.selectedBucket.label}" was deleted`)

                    this.setState({
                        buckets: newBucketList,
                        selectedBucket: {},
                    })
                }
            })
    }

    loadDataFromBucket = (bucketName, keyFilter) => {
        this.setState({
            showLoader: true
        })

        let formData = new FormData();
        formData.append("bucket", bucketName)
        if (_.size(keyFilter) > 0) {
            formData.append("key", keyFilter)
        }

        formData.append("perPage", this.state.perPage)
        formData.append("page", this.state.currentPage)

        axios.post("/get-bucket-data", formData)
            .then(({data, status}) => {
                if (status === 200) {
                    this.setState({
                        loadedDataFromBucket: data.m,
                        pagination: data.pagination
                    })
                }
            })
            .finally(() => {
                this.setState({
                    showLoader: false
                })
            })
    }

    filterByKey = (val) => {
        this.setState({
            filterKeyString: val
        })

        if (this.timeoutId) clearTimeout(this.timeoutId);

        this.timeoutId = setTimeout(() => {
            this.loadDataFromBucket(this.state.selectedBucket.label, _.trim(val))
        }, 1000)
    }

    toJSONSwitch = (val, key) => {
        let {toJSON} = this.state
        if (_.has(toJSON, key)) {
            _.unset(toJSON, key)
        } else {
            _.set(toJSON, key, true)
        }
        this.setState({toJSON})
    }

    editData = (key, value) => {
        let {editData} = this.state;
        _.set(editData, key, {key, value});
        this.setState({
            editData
        });
    }

    editDataOnChange = (editDataKey, objKey, value) => {
        let {editData} = this.state
        _.set(editData, `${editDataKey}.${objKey}`, value)
        this.setState({editData})
    }

    deleteKey = (key) => {
        const formData = new FormData();
        formData.append("bucket", this.state.selectedBucket.label)
        formData.append("key", key)

        axios.post("/delete-key", formData)
            .then(({data, status}) => {
                if (data === "ok" && status === 200) {
                    showNotification("success", "Delete", `Key ${key} was successfully deleted`)
                    this.loadDataFromBucket(this.state.selectedBucket.label)
                }
            })
    }

    saveEditData = (key) => {
        let {editData} = this.state;
        const dataForSave = _.get(editData, key)

        const notifyMessage = (key === dataForSave.key)
            ? `Value with key ${key} was successfully updated`
            : `New key/value row was successfully created [key: ${dataForSave.key}]`;
        const titleMessage = (key === dataForSave.key)
            ? "Update"
            : "Create";

        let formData = new FormData();
        formData.append("bucket", this.state.selectedBucket.label)
        formData.append("key", dataForSave.key)
        formData.append("value", dataForSave.value)

        axios.post("/put", formData)
            .then(({data, status}) => {
                if (status === 200 && data === "ok") {
                    showNotification("success", titleMessage, notifyMessage)
                    _.unset(editData, key)
                    this.setState({
                        editData
                    })
                    this.loadDataFromBucket(this.state.selectedBucket.label)
                } else {
                    showNotification("error", "Error", "Something wrong. Can't save data")
                }
            })
            .catch(() => {
                showNotification("error", "Error", "Something wrong. Can't save data")
            })
    }

    newKeyValue = () => {
        const {loadedDataFromBucket, editData} = this.state
        const emptyFieldsWithLoadedDataFromBucket = _.assign({"": ""}, loadedDataFromBucket)
        _.set(editData, "", {key: "", value: ""})

        this.setState({
            loadedDataFromBucket: emptyFieldsWithLoadedDataFromBucket,
            editData
        })
    }

    cancelEditData = (key) => {
        let {editData, loadedDataFromBucket} = this.state
        _.unset(editData, key)
        if (key === "") {
            _.unset(loadedDataFromBucket, "")
        }
        this.setState({editData, loadedDataFromBucket})
    }

    changePage = (page) => {
        this.setState({
            currentPage: _.toInteger(page)
        })
        setTimeout(() => this.loadDataFromBucket(this.state.selectedBucket.label, this.state.filterKeyString), 300)
    }

    changePageSize = (pageSize) => {
        this.setState({
            perPage: _.toInteger(pageSize)
        })
        setTimeout(() => this.loadDataFromBucket(this.state.selectedBucket.label, this.state.filterKeyString), 300)
    }

    render() {
        let bucketsMenuList = (_.size(this.state.buckets) > 0) ? [{
            label: 'Buckets',
            key: 'bucket-list',
            children: this.state.buckets
        }] : []

        return (
            <Layout>
                <Header className="header">
                    <div className="logo"/>
                </Header>
                <Spin spinning={this.state.loaderDB} tip="Loading bolt databases...">
                    <Layout>
                        <Sider width={350} className="site-layout-background">
                            <Select
                                options={this.state.dbs}
                                placeholder="Select database"
                                style={{width: '100%'}}
                                value={this.state.selectedDatabase}
                                onChange={(val) => this.loadDB(val)}
                            />
                            <Menu
                                mode="inline"
                                selectedKeys={[this.state.selectedBucket.key]}
                                defaultOpenKeys={['bucket-list']}
                                style={{
                                    height: '100%',
                                    borderRight: 0,
                                }}
                                items={bucketsMenuList}
                                onClick={(val) => this.selectBucket(val.key)}
                            />
                        </Sider>
                        <Layout
                            style={{
                                padding: '0 24px 24px',
                            }}
                        >
                            <Row style={{height: 54}}>
                                <Col span={14} style={{
                                    display: "flex",
                                    alignItems: "center",
                                }}>
                                    <Input
                                        placeholder="Filter data by key"
                                        allowClear="true"
                                        style={{width: 200, marginRight: 20}}
                                        disabled={!(_.size(this.state.selectedBucket) > 0)}
                                        onChange={(e) => this.filterByKey(e.target.value)}
                                        value={this.state.filterKeyString}
                                    />
                                    <Tooltip title="Show all JSON as a tree format" placement="bottom">
                                        <Switch
                                            checkedChildren="JSON"
                                            unCheckedChildren="JSON"
                                            checked={this.state.allToJSON}
                                            onChange={(val) => this.setState({allToJSON: val})}
                                            disabled={!(_.size(this.state.selectedBucket) > 0)}
                                        />
                                    </Tooltip>
                                </Col>
                                <Col span={10} style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "flex-end"
                                }}>
                                    {_.size(this.state.selectedBucket) > 0 && <React.Fragment>
                                        <Button
                                            type="primary"
                                            icon={<FileAddOutlined/>}
                                            onClick={() => this.newKeyValue()}
                                            disabled={_.has(this.state.editData, "")}
                                        >
                                            Create key/value
                                        </Button>
                                        &nbsp;
                                        <Popconfirm
                                            title="Are you sure to delete this bucket?"
                                            onConfirm={() => this.deleteBucket()}
                                            // onCancel={cancel}
                                            okText="Yes"
                                            cancelText="No"
                                        >
                                            <Button
                                                type="primary"
                                                danger
                                                icon={<DeleteOutlined/>}
                                            >
                                                Delete bucket
                                            </Button>
                                        </Popconfirm>
                                    </React.Fragment>
                                    }
                                </Col>
                            </Row>

                            <Spin spinning={this.state.showLoader} tip={"Loading..."}>
                                <Content
                                    className="site-layout-background"
                                    style={{
                                        padding: 24,
                                        margin: 0,
                                        minHeight: 280,
                                    }}
                                >
                                    {(_.size(this.state.loadedDataFromBucket) > 0
                                        || _.size(this.state.selectedBucket) === 0)
                                        ? <React.Fragment>
                                            <List
                                                itemLayout="horizontal"
                                            >
                                                {Object.keys(this.state.loadedDataFromBucket).map((k) => {
                                                    const isJSON = isJsonString(this.state.loadedDataFromBucket[k]);
                                                    const obj = (
                                                        isJSON
                                                        && (this.state.allToJSON || _.has(this.state.toJSON, k))
                                                        && !_.has(this.state.editData, k)
                                                    )
                                                        ? <JSONTree
                                                            theme={theme}
                                                            data={JSON.parse(this.state.loadedDataFromBucket[k])}
                                                        />
                                                        : !_.has(this.state.editData, k)
                                                            ? this.state.loadedDataFromBucket[k]
                                                            : <Input.TextArea
                                                                key={k}
                                                                autosize={{minRows: 4, maxRows: 8}}
                                                                value={_.get(this.state.editData, `${k}.value`)}
                                                                onChange={(e) => this.editDataOnChange(k, "value", e.target.value)}
                                                            />;

                                                    const keyField = _.has(this.state.editData, k)
                                                        ? <Input
                                                            placeholder="Key"
                                                            value={_.get(this.state.editData, `${k}.key`)}
                                                            onChange={(val) => this.editDataOnChange(k, "key", val.target.value)}
                                                        />
                                                        : <Typography.Text type="secondary">
                                                            {k}
                                                        </Typography.Text>

                                                    return <List.Item key={k}>
                                                        <div style={{width: "100%"}}>
                                                            <Row style={{marginBottom: 10}}>
                                                                <Col span={18}>
                                                                    {keyField}
                                                                </Col>
                                                                <Col span={6} style={{textAlign: "right"}}>
                                                                    {isJSON && <React.Fragment>
                                                                        <Tooltip
                                                                            title="Show that JSON as a tree format"
                                                                            placement="left"
                                                                        >
                                                                            <Switch
                                                                                size="small"
                                                                                checkedChildren="JSON"
                                                                                unCheckedChildren="JSON"
                                                                                checked={_.get(this.state.toJSON, k)}
                                                                                onChange={(val) => this.toJSONSwitch(val, k)}
                                                                                disabled={this.state.allToJSON}
                                                                                style={{margin: "0 5px"}}
                                                                            />
                                                                        </Tooltip> |
                                                                    </React.Fragment>}
                                                                    <Tooltip title="Edit" placement="left">
                                                                        <a
                                                                            onClick={() => this.editData(k, this.state.loadedDataFromBucket[k])}
                                                                            style={{margin: "0 5px"}}
                                                                        >
                                                                            <EditOutlined/>
                                                                        </a>
                                                                    </Tooltip> |
                                                                    <Tooltip title="Delete" placement="left">
                                                                        <a
                                                                            onClick={() => this.deleteKey(k)}
                                                                            style={{margin: "0 5px"}}
                                                                        >
                                                                            <DeleteOutlined/>
                                                                        </a>
                                                                    </Tooltip>
                                                                </Col>
                                                            </Row>
                                                            <Row style={{marginBottom: 10}}>
                                                                <Col span={24}>
                                                                    {obj}
                                                                </Col>
                                                            </Row>
                                                            {_.has(this.state.editData, k) && <Row>
                                                                <Col span={12}>
                                                                    <Button
                                                                        type="primary"
                                                                        icon={<SaveOutlined/>}
                                                                        onClick={() => this.saveEditData(k)}
                                                                    >Save</Button>
                                                                    <Button
                                                                        type="default"
                                                                        style={{marginLeft: 10}}
                                                                        icon={<CloseCircleOutlined/>}
                                                                        onClick={() => this.cancelEditData(k)}
                                                                    >Cancel</Button>
                                                                </Col>
                                                            </Row>}
                                                        </div>
                                                    </List.Item>
                                                })}
                                            </List>
                                            {(_.size(this.state.loadedDataFromBucket) > 0)
                                                && <Pagination
                                                    total={this.state.pagination.total}
                                                    defaultPageSize="25"
                                                    pageSize={this.state.perPage}
                                                    pageSizeOptions={[5, 25, 50, 100, 200]}
                                                    onChange={(page, pageSize) => this.changePage(page)}
                                                    onShowSizeChange={(current, size) => this.changePageSize(size)}
                                                />}
                                        </React.Fragment>
                                        : <Empty
                                            description={`No data in that bucket. ${_.size(this.state.filterKeyString) > 0 ? `Try to clear filter` : ``}`}/>}
                                </Content>
                            </Spin>
                        </Layout>
                    </Layout>
                </Spin>
            </Layout>
        );
    }
}

export default App;
