import { Component, OnInit, ContentChildren, QueryList, AfterContentInit, Input, TemplateRef, HostListener, OnChanges, SimpleChanges, enableProdMode } from "@angular/core";


export interface ILayoutNode {
	xPos: number;
	yPos: number;
	width: number;
	height: number;
	Id: string;
  parent?: string;
  Title?: string;
}

interface IUnitStyle {
	"grid-column-start"?: number;
	"grid-column-end"?: number;
	"grid-row-start"?: number;
	"grid-row-end"?: number;
	"-ms-grid-column"?: number;
	"-ms-grid-column-span"?: number;
	"-ms-grid-row"?: number;
	"-ms-grid-row-span"?: number;

	"visibility"?: string;
}


@Component({
	selector: "app-org-chart",
	templateUrl: "./org-chart.component.html",
	styleUrls: ["./org-chart.component.scss"]
})
export class OrgChartComponent implements OnInit {

	//For adding children
	@Input() beforeAddChild: (newLayout: ILayoutNode[], parentNode: ILayoutNode) => [ILayoutNode[], ILayoutNode, boolean];
	@Input() beforeStateChange: (layout: ILayoutNode[], layoutState: ILayoutNode[][], currentStateIndex: number) => [ILayoutNode[], ILayoutNode[][], number, boolean];
	@Input() beforeMouseMove: (event: MouseEvent, movingNode: ILayoutNode, mouseStartX: number, mouseStartY: number, xPosStart: number, yPosStart: number ) => [MouseEvent, ILayoutNode, boolean];
	// tslint:disable-next-line:no-any
	@Input() beforeAfterContentInit: (childComponentQuery) => [Array<TemplateRef<any>>, boolean];
	@Input() beforeOnChanges: (changes) => [SimpleChanges, boolean];
	@Input() beforeRevertChange: (layout, layoutState, index) => [ILayoutNode[][], number, boolean];
	@Input() beforeDragStart: (event, node) => [MouseEvent, ILayoutNode, boolean];
	@Input() beforeDragEnd: (event, node) => void;
	@Input() beforePaint: (layout) => ILayoutNode[];

	@Input() afterAddChild: (newLayout: ILayoutNode[], parentNode: ILayoutNode, childNode: ILayoutNode) => void;
	@Input() afterStateChange: (layout: ILayoutNode[], layoutState: ILayoutNode[][], currentStateIndex: number) => void;
	@Input() afterMouseMove: (event: MouseEvent, movingNode: ILayoutNode, mouseStartX: number, mouseStartY: number, xPosStart: number, yPosStart: number ) => void;
	@Input() afterAfterContentInit: (childComponents) => void;
	@Input() afterOnChanges: (changes) => void;
	@Input() afterRevertChange: (layout, layoutState, index) => void;
	@Input() afterDragStart: (event, node) => void;
	@Input() afterDragEnd: (event, node) => void;
	@Input() afterPaint: (layout) => void;

	public activeNode: undefined | ILayoutNode;

	// tslint:disable-next-line:no-any
	public myChildComponents: Array<TemplateRef<any>> = [];

	//for setting up the grid enviornment
	@Input() width: number;
	@Input() height: number;
	@Input() columnWidth: number;
	@Input() rowWidth: number;

	//For styling
	@Input() layout: ILayoutNode[] = [{
    xPos: 10,
    yPos: 10,
    width: 18,
    height: 12,
    Id: "root",
  }];
	public	 myCardsKeyedById: {} = {};
	public	 myCardsKeyedByParentId: {} = {};
	public	 myCardStyles: {} = {};
	public	 myStemStyles: IUnitStyle[] = [];
	public	 myHorizontalLineStyles: IUnitStyle[] = [];
	public	 myVerticalLineStyles: IUnitStyle[] = [];
  	public	 actionMenuStyle: IUnitStyle = {"visibility": "hidden"};
  	public	 myCollapsedCards: {} = {};

  	//For handling undo Redo Actions
	public layoutState: ILayoutNode[][] = [JSON.parse(JSON.stringify(this.layout))];
  	public currentStateIndex: number = 0;

	//For Tracking while dragging
	private xPosStart: undefined | number;
	private yPosStart: undefined | number;
	private mouseStartX: undefined | number;
	private mouseStartY: undefined | number;
  	private movingNode: undefined | ILayoutNode;
  	private scrollPosX: undefined | number;
  	private scrollPosY: undefined | number;
  	private lastMousePosX: undefined | number;
  	private lastMousePosY: undefined | number;

	private isIE: boolean = false; //browser.satisfies({windows: {"internet explorer": ">10"}});

	@HostListener("document:mousemove", ["$event"])
		onMouseMove(event: MouseEvent): void {
			if (!this.movingNode) {
				//Don't fire logic if there is no node currently being dragged
				return;
			}
			this.updateCardsAndLines(event);
    }

    @HostListener("window:scroll", ["$event"])
      onScroll(event): void {
        if (!this.movingNode) {
          //Don't fire logic if there is no node currently being dragged
          return;
        }
        this.updateCardsAndLines();
      }

	constructor() { }

	public ngOnInit() {
		this.columnWidth	= this.columnWidth	|| 10;
    	this.rowWidth		= this.rowWidth	|| 10;
    	this.width			= this.width	  || Math.floor(window.innerWidth / this.columnWidth);
    	this.height			= this.height		|| Math.floor(window.innerHeight / 10);

		this.updateGridViewAndDictionaries();
	}

	protected onDragStart(event: MouseEvent, node: ILayoutNode): void {
		let returnedEvent, returnedNode, preventDefault;
		if (this.beforeDragStart) {
			[returnedEvent, returnedNode, preventDefault] = this.beforeDragStart(event, node);
		}
		if (preventDefault) {
			return;
		}
		event = returnedEvent || event;
		node = returnedNode || node;
		this.movingNode = node;
		this.activeNode = node;

		this.mouseStartX = event.x;
		this.mouseStartY = event.y;

		this.xPosStart = this.movingNode.xPos;
    	this.yPosStart = this.movingNode.yPos;

    	this.scrollPosX = window.pageXOffset;
		this.scrollPosY = window.pageYOffset;
		this.generateActionMenu();

		if (this.afterDragEnd) { this.afterDragStart(event, node); }
	}

	public onDragEnd(event: MouseEvent): void {
		if (this.beforeDragEnd) { this.beforeDragEnd(event, this.movingNode); }

		this.mouseStartX = undefined;
		this.mouseStartY = undefined;

		this.xPosStart = undefined;
		this.yPosStart = undefined;

    	this.movingNode	= undefined;

    	this.scrollPosX = undefined;
		this.scrollPosY = undefined;
    	this.updateGridViewAndDictionaries();
    	if (this.afterDragEnd) { this.afterDragEnd(event, this.movingNode); }
	}

	public toggleCollapseCard(Id: string) {
    	this.myCollapsedCards[Id] = !this.myCollapsedCards[Id]

		this.updateGridViewAndDictionaries();
	}

	// Begin UI function Definitions (Add Nodes, Remove Nodes, Collapse Nodes)
	public AddCard(Id: string): void {
		let newLayout	 = this.layout.slice(0);
    	const newSelector = Math.random().toString();
		const parentNode	= this.myCardsKeyedById[Id];

		let returnedLayout, returnedChild, preventDefault;
		if (this.beforeAddChild) {
			[returnedLayout, returnedChild, preventDefault] = this.beforeAddChild(newLayout, parentNode);
		}
		if (preventDefault) {
			return;
		}
		newLayout = returnedLayout || newLayout;
		const newChild = returnedChild || {
			xPos: Math.max(parentNode.xPos - parentNode.width / 2, 1),
			yPos: Math.max(parentNode.yPos + parentNode.height + 3, 1),
			width: 18,
			height: 12,
			Id: newSelector,
			parent: Id
		} as ILayoutNode;

		newLayout.push(newChild);
		this.layout = newLayout;

		if (this.afterAddChild) { this.afterAddChild(newLayout, parentNode, newChild); }
		this.updateGridViewAndDictionaries();
	}

	public deleteCard(Id: string): void {
		const cardsToDelete = [this.myCardsKeyedById[Id]].concat(this.getSubTree(this.myCardsKeyedByParentId[Id]));
		const IdsToDelete	 = cardsToDelete.map((card) => card.Id);
    	this.layout = this.layout.filter((card) => IdsToDelete.findIndex((Id) => Id === card.Id) === -1);
		this.actionMenuStyle = {"visibility": "hidden"};

		this.updateGridViewAndDictionaries();
	}

	//refactor to remove this function or make it private
	public generateContainerStyles() {

		return {
			"grid-template-columns"	: `repeat(${this.width}	, ${this.columnWidth}px)`,
			"grid-template-rows"	  : `repeat(${this.height} , ${this.rowWidth	 }px)`,
			};
	}

	private generateCardDictionaryById(): void {
		this.myCardsKeyedById = {};
		this.layout.forEach((node) => {
			this.myCardsKeyedById[node.Id] = Object.assign({}, node);
		});
	}

	private generateCardDictionaryByParentId(): void {
		this.myCardsKeyedByParentId = {};
		this.layout.forEach((node) => {
			if (node.parent && this.myCardsKeyedByParentId[node.parent]) {
				this.myCardsKeyedByParentId[node.parent].push(node);
			} else if (node.parent) {
				this.myCardsKeyedByParentId[node.parent] = [];
				this.myCardsKeyedByParentId[node.parent].push(node);
			}
		});
	}

	private generateLineStyles(xStart: number, xStop: number, yStart: number, yStop: number): IUnitStyle {
		return {
			"grid-column-start" : xStart,
			"grid-column-end"	: xStop ,
			"grid-row-start"	: yStart,
			"grid-row-end"		: yStop
		} as IUnitStyle;
	}

	private generateStemStyles(nodes: ILayoutNode[]): IUnitStyle[] {
		const stemStyles = nodes.filter((node) => !this.isCardCollapsed(node.Id)).filter((parentNode) => this.layout.filter((node) => node.parent === parentNode.Id).length).map((node) => {
			return this.generateLineStyles(
				node.xPos + node.width / 2 - 1,
				node.xPos + node.width / 2 + 1,
				node.yPos + node.height / 2	 ,
				node.yPos + node.height	+ 3);
		});

		return stemStyles;
	}

	private generateHorizontalLineStyles(node: ILayoutNode, childNode: ILayoutNode) {
		const HorizontalLineStyle = this.generateLineStyles(
			node.xPos			+ node.width / 2,
			childNode.xPos + childNode.width / 2,
			node.yPos			+ node.height,
			node.yPos			+ node.height + 2);

		return HorizontalLineStyle;
	}

	private generateVerticalLineStyles(node: ILayoutNode, childNode: ILayoutNode) {
		const VerticalLineStyle = this.generateLineStyles(
			childNode.xPos + childNode.width / 2	- 1,
			childNode.xPos + childNode.width / 2	+ 1,
			node.yPos			+ node.height	+ 2,
			childNode.yPos + childNode.height / 2 + 5);
		return VerticalLineStyle;
	}

	private generateLines(): void {
		this.myHorizontalLineStyles = [];
		this.myVerticalLineStyles	 = [];

		this.layout
			.forEach((node) => {
				this.layout.filter((childNode) => childNode.parent === node.Id)
					.forEach((childNode) => {
						if (!this.isCardCollapsed(node.Id)) {
              if (!(node.xPos === childNode.xPos)){
							this.myHorizontalLineStyles
							.push(this.generateHorizontalLineStyles(node, childNode));
              }
							this.myVerticalLineStyles
							.push(this.generateVerticalLineStyles(node, childNode));
						}
					});
		});
	}

	private generateCardStyles(node: ILayoutNode) {
		return this.generateAreaStyle(node.xPos, node.yPos, node.width, node.height);
	}

	private generateAreaStyle(xPos: number, yPos: number, width: number, height: number) {
		if (this.isIE) {
			return {
				"-ms-grid-column"			: xPos ,
				"-ms-grid-column-span" : width,
				"-ms-grid-row"				 : yPos ,
				"-ms-grid-row-span"		: height,
			} as IUnitStyle;
		}
		return {
			"grid-column-start" : xPos ,
			"grid-column-end"	 : xPos + width,
			"grid-row-start"		: yPos ,
			"grid-row-end"			: yPos + height,
		} as IUnitStyle;
	}

	private generateActionMenu(): void {
		if (this.activeNode) {
			this.actionMenuStyle = this.generateAreaStyle(this.activeNode.xPos, this.activeNode.yPos - 4, 9, 3);
		}
	}

	private generateCards(): void {
		this.myCardStyles = {};
		this.layout.forEach((node) => this.myCardStyles[node.Id] = this.isCardCollapsed(node.parent) ? {"visibility": "hidden"} : this.generateCardStyles(node));
		this.myStemStyles	 = this.generateStemStyles(this.layout);
  }

  private isCardCollapsed(Id) {
    if (!(this.myCardsKeyedById[Id])) {
      return false;
    }
    return this.myCollapsedCards[Id] || this.isCardCollapsed(this.myCardsKeyedById[Id].parent);
  }

	private updateGridViewAndDictionaries(): void {
		if (this.beforePaint) { this.layout = this.beforePaint(this.layout) || this.layout; }

    this.generateCardDictionaryByParentId();
		this.generateCardDictionaryById();
		this.generateCards();
		this.generateLines();

		if (this.afterPaint) { this.afterPaint(this.layout); }
	}

	private updateCardsAndLines(event?: MouseEvent): void {
		if (!(this.movingNode && this.mouseStartX && this.mouseStartY && this.xPosStart && this.yPosStart)) {
			return;
		}
		let returnedEvent, returnedMovingNode, preventDefault;
		if (this.beforeMouseMove) {
			[returnedEvent, returnedMovingNode, preventDefault] =
			this.beforeMouseMove(event,
				this.movingNode,
				this.mouseStartX,
				this.mouseStartY,
				this.xPosStart,
				this.yPosStart);
		}
		if (preventDefault) {
			return;
		}

    	event = returnedEvent || event;
    	const mousePosX = (event && event.x) || this.lastMousePosX;
    	const mousePosY = (event && event.y) || this.lastMousePosY;

    	this.lastMousePosX = mousePosX;
    	this.lastMousePosY = mousePosY;


		if (returnedMovingNode) {
			this.movingNode = returnedMovingNode;
		} else {
			const newXPos = Math.min(Math.max(this.xPosStart + Math.round(((mousePosX - this.mouseStartX) + (window.pageXOffset - this.scrollPosX)) / this.columnWidth), 1), (this.width - this.movingNode.width));
			const newYPos = Math.min(Math.max(this.yPosStart + Math.round(((mousePosY - this.mouseStartY) + (window.pageYOffset - this.scrollPosY)) / this.rowWidth), 1), (this.height - this.movingNode.height));

			if (this.movingNode.xPos === newXPos && this.movingNode.yPos === newYPos) {
				return;
			} else {
				this.movingNode.xPos = newXPos;
				this.movingNode.yPos = newYPos;
			}
		}

		if (this.afterMouseMove && this.movingNode) { this.afterMouseMove(event, this.movingNode, this.mouseStartX, this.mouseStartY, this.xPosStart, this.yPosStart); }
		//Regenerate Card Styles
		if (this.movingNode) { this.myCardStyles[this.movingNode.Id] = this.generateCardStyles(this.movingNode); }

		//Regenerate action menu styles
		this.generateActionMenu();

		//Regenerate Stem styles
		this.myStemStyles = [];
		this.myStemStyles = this.generateStemStyles(this.layout);

		//Regenerate Line Styles
		this.generateLines();

	}

	// tslint:disable-next-line:no-any
	private getSubTree(array: any[]): any[] {
		let subTree = array || [];
		subTree.forEach((node) => {
			if (this.myCardsKeyedByParentId[node.Id]) {
				const childSub = this.getSubTree(this.myCardsKeyedByParentId[node.Id]);
				subTree = subTree.concat(childSub);
			}
		});
		return subTree;
	}
}
