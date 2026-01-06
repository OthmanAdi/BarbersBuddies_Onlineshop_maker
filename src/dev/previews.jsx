import {ComponentPreview, Previews} from '@react-buddy/ide-toolbox'
import {PaletteTree} from './palette'
import ShopLandingPage from "../components/ShopLandingPage";

const ComponentPreviews = () => {
    return (
        <Previews palette={<PaletteTree/>}>
            <ComponentPreview path="/ShopLandingPage">
                <ShopLandingPage/>
            </ComponentPreview>
        </Previews>
    )
}

export default ComponentPreviews