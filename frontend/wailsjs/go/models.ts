export namespace main {
	
	export class FileResult {
	    content: string;
	    filename: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new FileResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.content = source["content"];
	        this.filename = source["filename"];
	        this.error = source["error"];
	    }
	}

}

