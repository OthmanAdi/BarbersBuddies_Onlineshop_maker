import React from 'react';
import {motion} from 'framer-motion';
import {Link as LinkIcon} from 'lucide-react';
import CopyLinkButton from "./CopyLinkButton";

const ShopLinkDisplay = ({linkToCopy}) => {
    return (<div className="form-control">
            <motion.div
                initial={{opacity: 0, y: 10}}
                animate={{opacity: 1, y: 0}}
                className="relative mt-2"
            >
                {/* Glass background */}
                <div className="absolute inset-0 rounded-xl
          dark:bg-base-100/20 bg-base-200/40
          backdrop-blur-md border border-base-content/10"
                />

                {/* Glow effect */}
                <motion.div
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    className="absolute -inset-0.5 rounded-xl blur-md
            dark:bg-gradient-to-r dark:from-primary/20 dark:via-secondary/20 dark:to-accent/20
            bg-gradient-to-r from-warning/30 via-error/30 to-secondary/30"
                />

                {/* Content */}
                <div className="relative p-4">
                    <label className="label cursor-pointer justify-between items-center mb-2">
            <span className="label-text flex items-center gap-2 font-medium">
              <LinkIcon className="w-4 h-4"/>
              Shop Link
            </span>
                        <CopyLinkButton linkToCopy={linkToCopy}/>
                    </label>

                    <motion.div
                        whileHover={{scale: 1.01}}
                        className="text-sm md:text-base font-mono px-3 py-2 rounded-lg
              dark:bg-base-100/20 bg-base-200/40
              break-all transition-colors"
                    >
                        {linkToCopy}
                    </motion.div>
                </div>
            </motion.div>
        </div>);
};

export default ShopLinkDisplay;