export namespace database {
	
	export class Group {
	    created: number;
	    updated: number;
	    items: string[];
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new Group(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.created = source["created"];
	        this.updated = source["updated"];
	        this.items = source["items"];
	        this.name = source["name"];
	    }
	}
	export class GroupUpdate {
	    groupId: string;
	    group: Group;
	    mask: string[];
	
	    static createFrom(source: any = {}) {
	        return new GroupUpdate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.groupId = source["groupId"];
	        this.group = this.convertValues(source["group"], Group);
	        this.mask = source["mask"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class IterationConstraint {
	    type: string;
	    iterations: number;
	    charset: string;
	
	    static createFrom(source: any = {}) {
	        return new IterationConstraint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.iterations = source["iterations"];
	        this.charset = source["charset"];
	    }
	}
	export class Ruleset {
	    optional: boolean;
	    minLength: number;
	    maxLength: number;
	    passwordTTLIncrement: number;
	    passwordTTLUnit: number;
	    reuse: boolean;
	    charset: string;
	    sameCharMax: number;
	    atMostConstraints: IterationConstraint[];
	    atLeastConstraints: IterationConstraint[];
	
	    static createFrom(source: any = {}) {
	        return new Ruleset(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.optional = source["optional"];
	        this.minLength = source["minLength"];
	        this.maxLength = source["maxLength"];
	        this.passwordTTLIncrement = source["passwordTTLIncrement"];
	        this.passwordTTLUnit = source["passwordTTLUnit"];
	        this.reuse = source["reuse"];
	        this.charset = source["charset"];
	        this.sameCharMax = source["sameCharMax"];
	        this.atMostConstraints = this.convertValues(source["atMostConstraints"], IterationConstraint);
	        this.atLeastConstraints = this.convertValues(source["atLeastConstraints"], IterationConstraint);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class Item {
	    created: number;
	    updated: number;
	    type: string;
	    title: string;
	    archived: boolean;
	    email: string;
	    username: string;
	    password: string;
	    passwordCreated: number;
	    prevPasswords: string[];
	    websites: string[];
	    twoFactorSecret: string;
	    notes: string;
	    ruleset: Ruleset;
	
	    static createFrom(source: any = {}) {
	        return new Item(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.created = source["created"];
	        this.updated = source["updated"];
	        this.type = source["type"];
	        this.title = source["title"];
	        this.archived = source["archived"];
	        this.email = source["email"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.passwordCreated = source["passwordCreated"];
	        this.prevPasswords = source["prevPasswords"];
	        this.websites = source["websites"];
	        this.twoFactorSecret = source["twoFactorSecret"];
	        this.notes = source["notes"];
	        this.ruleset = this.convertValues(source["ruleset"], Ruleset);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class InsertItemsArg {
	    Item: Item;
	    GroupIds: string[];
	
	    static createFrom(source: any = {}) {
	        return new InsertItemsArg(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Item = this.convertValues(source["Item"], Item);
	        this.GroupIds = source["GroupIds"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class ItemUpdate {
	    itemId: string;
	    item: Item;
	    groupIds: string[];
	    mask: string[];
	    rulesetMask: string[];
	    includeGroupIds: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ItemUpdate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.itemId = source["itemId"];
	        this.item = this.convertValues(source["item"], Item);
	        this.groupIds = source["groupIds"];
	        this.mask = source["mask"];
	        this.rulesetMask = source["rulesetMask"];
	        this.includeGroupIds = source["includeGroupIds"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	

}

